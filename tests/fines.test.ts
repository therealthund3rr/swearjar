import { describe, expect, it } from "vitest";
import { OBJECTION_WINDOW_MS, VOTE_TIMEOUT_MS, objectionPending, owedCents, resolveObjections, verdictToFines } from "@/lib/fines";
import { defaultRuleSet, type RuleSet, type VerdictHit } from "@/lib/rules";
import type { Fine } from "@/lib/types";

const CAP = 1000;
const rules = defaultRuleSet(CAP);
let n = 0;
const newId = () => `f${++n}`;

const hit = (o: Partial<VerdictHit> = {}): VerdictHit => ({
  quote: "cazzo",
  normalized: "cazzo",
  tier_id: "strong",
  is_mention: false,
  confidence: 0.9,
  reason: "Strong swear",
  ...o,
});

function run(o: { hits?: VerdictHit[]; playerId?: string; ts?: number; idx?: number; existing?: Fine[]; rules?: RuleSet; multiplier?: number } = {}) {
  return verdictToFines({
    playerId: o.playerId ?? "a",
    utteranceIndex: o.idx ?? 0,
    ts: o.ts ?? 100_000,
    hits: o.hits ?? [hit()],
    rules: o.rules ?? rules,
    multiplier: o.multiplier ?? 1,
    capCents: CAP,
    existingFines: o.existing ?? [],
    source: "ai",
    mode: "party",
    newId,
  });
}

describe("verdictToFines", () => {
  it("creates an active, masked fine with deadlines", () => {
    const { fines } = run();
    expect(fines).toHaveLength(1);
    expect(fines[0]).toMatchObject({ playerId: "a", masked: "c***o", priceCents: 100, status: "active", objection: null, tierId: "strong", multiplier: 1 });
    expect(fines[0].objectableUntil).toBe(100_000 + OBJECTION_WINDOW_MS);
  });

  it("drops unknown tiers, mentions, free terms, low confidence", () => {
    expect(run({ hits: [hit({ tier_id: "nope" })] }).fines).toHaveLength(0);
    expect(run({ hits: [hit({ is_mention: true })] }).fines).toHaveLength(0);
    expect(run({ hits: [hit()], rules: { ...rules, free_terms: ["cazzo"] } }).fines).toHaveLength(0);
    expect(run({ hits: [hit({ confidence: 0.49 })] }).fines).toHaveLength(0);
  });

  it("counts mentions when the rules say so", () => {
    expect(run({ hits: [hit({ is_mention: true })], rules: { ...rules, count_mentions: true } }).fines).toHaveLength(1);
  });

  it("confidence bands: 0.5-0.75 contested with an AI objection, 0.75+ active", () => {
    const low = run({ hits: [hit({ confidence: 0.6 })] }).fines[0];
    expect(low.status).toBe("contested");
    expect(low.objection).toEqual({ byPlayerId: "ai", votes: {}, deadline: 100_000 + VOTE_TIMEOUT_MS });
    expect(run({ hits: [hit({ confidence: 0.75 })] }).fines[0].status).toBe("active");
    expect(run({ hits: [hit({ confidence: 0.5 })] }).fines[0].status).toBe("contested");
  });

  it("applies the multiplier", () => {
    expect(run({ multiplier: 2 }).fines[0]).toMatchObject({ priceCents: 200, multiplier: 2 });
  });

  it("clamps the running total at the cap across many fines (and keeps 0-price fines)", () => {
    const hits = Array.from({ length: 15 }, (_, i) => hit({ quote: `w${i}`, tier_id: "blasphemy" })); // 15 x 200 = 3000
    const { fines } = run({ hits });
    expect(fines.map((f) => f.priceCents).reduce((a, b) => a + b, 0)).toBe(CAP);
    expect(fines).toHaveLength(15);
    expect(fines[14].priceCents).toBe(0);
    expect(owedCents("a", fines, CAP)).toBe(CAP);
  });

  it("counts existing fines of the same player toward the cap", () => {
    const first = run({ hits: [hit({ tier_id: "slur", quote: "x" })] }).fines;
    expect(first[0].priceCents).toBe(CAP);
    const more = run({ existing: first, idx: 1, hits: [hit()] }).fines;
    expect(more[0].priceCents).toBe(0);
  });

  it("dedupes the same quote in the same utterance, including against existing fines", () => {
    expect(run({ hits: [hit(), hit()] }).fines).toHaveLength(1);
    const first = run().fines;
    expect(run({ existing: first }).fines).toHaveLength(0);
    expect(run({ existing: first, idx: 1 }).fines).toHaveLength(1);
  });

  it("slur always charges the cap, masked and with a neutral reason", () => {
    const f = run({ hits: [hit({ tier_id: "slur", quote: "something", reason: "rude" })], multiplier: 3 }).fines[0];
    expect(f.priceCents).toBe(CAP);
    expect(f.masked).toBe("⚠ hateful language");
    expect(f.reason).not.toContain("rude");
  });

  it("passes the alternative through", () => {
    expect(run({ hits: [hit({ alternative: "cavolo" })] }).fines[0].alternative).toBe("cavolo");
  });

  it("cross-talk: second player within 3 s is dropped, the first fine is flagged contested", () => {
    const first = run({ playerId: "a", ts: 100_000 }).fines;
    const r = run({ playerId: "b", ts: 102_500, existing: first });
    expect(r.fines).toHaveLength(0);
    expect(r.contestedIds).toEqual([first[0].id]);
  });

  it("cross-talk: 4 s apart both are fined", () => {
    const first = run({ playerId: "a", ts: 100_000 }).fines;
    const r = run({ playerId: "b", ts: 104_000, existing: first });
    expect(r.fines).toHaveLength(1);
    expect(r.contestedIds).toEqual([]);
  });

  it("cross-talk: out-of-order delivery creates the earlier one as contested and flags the other", () => {
    const later = run({ playerId: "b", ts: 102_000 }).fines;
    const r = run({ playerId: "a", ts: 100_000, existing: later });
    expect(r.fines).toHaveLength(1);
    expect(r.fines[0].status).toBe("contested");
    expect(r.contestedIds).toEqual([later[0].id]);
  });

  it("cross-talk ignores dropped fines and other words", () => {
    const first = run({ playerId: "a", ts: 100_000 }).fines.map((f) => ({ ...f, status: "dropped" as const }));
    expect(run({ playerId: "b", ts: 101_000, existing: first }).fines).toHaveLength(1);
    const act = run({ playerId: "a", ts: 100_000 }).fines;
    expect(run({ playerId: "b", ts: 101_000, existing: act, hits: [hit({ normalized: "merda", quote: "merda" })] }).fines).toHaveLength(1);
  });
});

describe("owedCents", () => {
  it("ignores dropped fines and other players, caps the sum", () => {
    const base = run().fines[0];
    const fines: Fine[] = [base, { ...base, id: "x", status: "dropped" }, { ...base, id: "y", playerId: "b" }, { ...base, id: "z", status: "contested" }];
    expect(owedCents("a", fines, CAP)).toBe(200);
    expect(owedCents("a", fines, 150)).toBe(150);
  });
});

describe("resolveObjections", () => {
  const mk = (votes: Record<string, "keep" | "drop">, o: Partial<Fine> = {}): Fine => ({
    ...run({ hits: [hit({ confidence: 0.6 })] }).fines[0],
    objection: { byPlayerId: "ai", votes, deadline: 120_000 },
    ...o,
  });
  const players = ["a", "b", "c"]; // fine belongs to "a"

  it("leaves a vote in progress alone and returns a new array", () => {
    const f = mk({ b: "drop" });
    const input = [f];
    const out = resolveObjections(input, players, 110_000, false);
    expect(out).not.toBe(input);
    expect(out[0].status).toBe("contested");
    expect(objectionPending(f, 110_000)).toBe(true);
    expect(objectionPending(f, 120_000)).toBe(false);
  });

  it("majority drop when everyone voted", () => {
    expect(resolveObjections([mk({ b: "drop", c: "drop" })], players, 110_000, false)[0].status).toBe("dropped");
  });

  it("majority keep makes it active", () => {
    expect(resolveObjections([mk({ b: "keep", c: "keep" })], players, 110_000, false)[0].status).toBe("active");
  });

  it("tie or no votes: keep only if confidence >= 0.75", () => {
    expect(resolveObjections([mk({}, { confidence: 0.6 })], players, 125_000, false)[0].status).toBe("dropped");
    expect(resolveObjections([mk({}, { confidence: 0.9 })], players, 125_000, false)[0].status).toBe("active");
    expect(resolveObjections([mk({ b: "drop", c: "keep" }, { confidence: 0.6 })], players, 110_000, false)[0].status).toBe("dropped");
  });

  it("timeout resolves with the votes cast so far", () => {
    expect(resolveObjections([mk({ b: "drop" })], players, 121_000, false)[0].status).toBe("dropped");
    expect(resolveObjections([mk({ b: "keep" }, { confidence: 0.6 })], players, 121_000, false)[0].status).toBe("active");
  });

  it("force resolves immediately", () => {
    expect(resolveObjections([mk({})], players, 100_000, true)[0].status).toBe("dropped");
  });

  it("solo: waits for deadline/force, own vote decides", () => {
    const solo = ["a"];
    expect(resolveObjections([mk({})], solo, 110_000, false)[0].status).toBe("contested");
    expect(resolveObjections([mk({ a: "drop" }, { confidence: 0.9 })], solo, 121_000, false)[0].status).toBe("dropped");
    expect(resolveObjections([mk({ a: "keep" }, { confidence: 0.6 })], solo, 100_000, true)[0].status).toBe("active");
    expect(resolveObjections([mk({}, { confidence: 0.9 })], solo, 100_000, true)[0].status).toBe("active");
  });

  it("does not touch fines without an objection or already dropped", () => {
    const plain = run().fines[0];
    const dropped = mk({}, { status: "dropped" });
    const out = resolveObjections([plain, dropped], players, 999_999, true);
    expect(out[0]).toEqual(plain);
    expect(out[1].status).toBe("dropped");
  });

  it("keeps the objection object for history", () => {
    const out = resolveObjections([mk({ b: "drop", c: "drop" })], players, 110_000, false)[0];
    expect(out.objection?.votes).toEqual({ b: "drop", c: "drop" });
  });
});
