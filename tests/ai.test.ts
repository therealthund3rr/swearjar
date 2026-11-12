import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// lexicon/fines are owned by another agent: tests only need predictable stand-ins.
vi.mock("@/lib/lexicon", () => ({
  normalizeText: (s: string) => s,
  maskWord: (w: string) => w,
  lexiconScan: (text: string) =>
    /cazzo/i.test(text)
      ? [{ quote: "cazzo", normalized: "cazzo", tier_id: "strong", is_mention: false, confidence: 0.8, reason: "lexicon" }]
      : [],
}));
vi.mock("@/lib/fines", () => ({
  owedCents: () => 0,
  resolveObjections: (f: unknown) => f,
  verdictToFines: () => ({ fines: [], contestedIds: [] }),
  OBJECTION_WINDOW_MS: 30000,
  VOTE_TIMEOUT_MS: 20000,
}));

import { __setAiClientForTests, compileRules, judgeBatch } from "@/server/ai";
import { defaultRuleSet } from "@/lib/rules";

type Reply = string | Error;
function fakeClient(replies: Reply[]) {
  const calls: Record<string, unknown>[] = [];
  const create = vi.fn(async (body: Record<string, unknown>) => {
    calls.push(body);
    const r = replies.shift() ?? "{}";
    if (r instanceof Error) throw r;
    return { choices: [{ message: { content: r } }] };
  });
  __setAiClientForTests({ chat: { completions: { create } } });
  return { create, calls };
}

const saved = { ...process.env };
beforeEach(() => {
  process.env.AI_BASE_URL = "https://api.groq.com/openai/v1";
  process.env.AI_API_KEY = "test-key";
});
afterEach(() => {
  __setAiClientForTests(null);
  process.env = { ...saved };
});

describe("compileRules", () => {
  it("clamps prices to the cap and keeps the base tiers", async () => {
    fakeClient([
      JSON.stringify({
        tiers: [
          { id: "mild", label: "Mild", price_cents: 5000 },
          { id: "party", label: "Party", price_cents: 150 },
        ],
        free_terms: ["Cavolo"],
        multipliers: [{ id: "penalty", when: "penalties", factor: 9 }],
      }),
    ]);
    const r = await compileRules("cavolo is free, double on penalties", 500, "party");
    expect(r.tiers.find((t) => t.id === "mild")!.price_cents).toBe(500);
    for (const id of ["mild", "strong", "blasphemy", "slur"]) expect(r.tiers.some((t) => t.id === id)).toBe(true);
    expect(r.tiers.find((t) => t.id === "slur")!.price_cents).toBe(500);
    expect(r.free_terms).toEqual(["cavolo"]);
    expect(r.multipliers[0].factor).toBe(5);
  });

  it("retries once on invalid JSON, then falls back to the defaults", async () => {
    const { create } = fakeClient(["not json at all", "{ still: bad"]);
    const r = await compileRules("bestemmie 2 euro", 1000, "party");
    expect(create).toHaveBeenCalledTimes(2);
    expect(r.tiers.map((t) => t.id)).toEqual(defaultRuleSet(1000).tiers.map((t) => t.id));
  });

  it("returns defaults without calling the AI for empty text", async () => {
    const { create } = fakeClient([]);
    await compileRules("   ", 1000, "party");
    expect(create).not.toHaveBeenCalled();
  });

  it("never touches the network in lexicon mode", async () => {
    process.env.AI_API_KEY = "";
    const { create } = fakeClient([]);
    await compileRules("bestemmie 2 euro", 1000, "party");
    expect(create).not.toHaveBeenCalled();
  });
});

describe("judgeBatch", () => {
  const rules = defaultRuleSet(1000);
  const items = [
    { key: "a:0", playerId: "a", lang: "it-IT", text: "che cazzo fai", context: [] },
    { key: "b:0", playerId: "b", lang: "en-US", text: "what a nice day", context: [] },
  ];
  const hit = (quote: string) => ({ quote, normalized: "x", tier_id: "strong", is_mention: false, confidence: 0.9, reason: "r" });

  it("drops hits whose quote is not in the text and keeps the rest", async () => {
    fakeClient([
      JSON.stringify({
        results: [
          { key: "a:0", hits: [hit("cazzo"), hit("merda")] },
          { key: "b:0", hits: [hit("damn")] },
        ],
      }),
    ]);
    const r = await judgeBatch(items, rules, "party");
    expect(r.source).toBe("ai");
    expect(r.results["a:0"].map((h) => h.quote)).toEqual(["cazzo"]);
    expect(r.results["b:0"]).toEqual([]);
  });

  it("uses json_schema and low reasoning effort on Groq gpt-oss", async () => {
    const { calls } = fakeClient([JSON.stringify({ results: [] })]);
    await judgeBatch(items, rules, "party");
    expect((calls[0].response_format as { type: string }).type).toBe("json_schema");
    expect(calls[0].reasoning_effort).toBe("low");
  });

  it("falls back to the lexicon for the whole batch on 429", async () => {
    fakeClient([Object.assign(new Error("rate limited"), { status: 429 })]);
    const r = await judgeBatch(items, rules, "party");
    expect(r.source).toBe("lexicon");
    expect(r.results["a:0"]).toHaveLength(1);
    expect(r.results["b:0"]).toEqual([]);
  });

  it("falls back to the lexicon after two invalid answers", async () => {
    const { create } = fakeClient(["garbage", "{}"]);
    const r = await judgeBatch(items, rules, "party");
    expect(create).toHaveBeenCalledTimes(2);
    expect(r.source).toBe("lexicon");
  });
});
