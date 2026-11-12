import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

process.env.DATA_DIR = "./.data-test";

vi.mock("@/lib/lexicon", () => ({
  normalizeText: (s: string) => s,
  maskWord: (w: string) => w,
  lexiconScan: (text: string) => (/cazzo/i.test(text) ? [{ quote: "cazzo" }] : []),
}));
vi.mock("@/lib/fines", () => ({
  owedCents: () => 0,
  resolveObjections: (f: unknown) => f,
  OBJECTION_WINDOW_MS: 30000,
  VOTE_TIMEOUT_MS: 20000,
  // one fine per hit, enough to check the queue wiring (the real pricing is tested in fines.test.ts)
  verdictToFines: (a: { playerId: string; utteranceIndex: number; hits: { quote: string }[]; ts: number; newId: () => string; source: "ai" | "lexicon"; multiplier: number }) => ({
    fines: a.hits.map((h) => ({
      id: a.newId(), playerId: a.playerId, utteranceIndex: a.utteranceIndex, quote: h.quote, masked: "c***o", normalized: "cazzo",
      tierId: "strong", priceCents: 100 * a.multiplier, multiplier: a.multiplier, confidence: 0.9, reason: "r", status: "active",
      objection: null, source: a.source, ts: a.ts, objectableUntil: a.ts + 30000,
    })),
    contestedIds: [],
  }),
}));

import { defaultRuleSet } from "@/lib/rules";
import type { Session } from "@/lib/types";
import { __setAiClientForTests } from "@/server/ai";
import { enqueueUtterance } from "@/server/judge-queue";
import { createSession, getSession } from "@/server/store";

function makeSession(code: string, status: Session["status"] = "live"): Session {
  const mk = (id: string, creator: boolean) => ({ id, name: id, lang: "it-IT", isCreator: creator, sponsorId: null, hold: null, joinedAt: 0 });
  return {
    jar: {
      code, name: "t", mode: "party", capCents: 1000, currency: "USD", beneficiaryEmail: null, beneficiaryName: "x",
      rulesText: "", rules: defaultRuleSet(1000), rulesConfirmed: true, creatorPlayerId: "a", createdAt: 0,
    },
    status, players: { a: mk("a", true), b: mk("b", false) }, fines: [], utteranceCounter: {}, context: {},
    activeMultiplierId: null, aiBusy: false, startedAt: 0, endedAt: null, reports: {}, settle: {}, receiptId: null,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  process.env.AI_BASE_URL = "https://api.groq.com/openai/v1";
  process.env.AI_API_KEY = "k";
});
afterEach(() => {
  vi.useRealTimers();
  __setAiClientForTests(null);
});

describe("judge queue", () => {
  it("batches utterances of two players into ONE judge call and creates fines", async () => {
    const create = vi.fn(async () => ({
      choices: [{
        message: {
          content: JSON.stringify({
            results: [{ key: "a:0", hits: [{ quote: "cazzo", normalized: "cazzo", tier_id: "strong", is_mention: false, confidence: 0.9, reason: "r" }] }, { key: "b:0", hits: [] }],
          }),
        },
      }],
    }));
    __setAiClientForTests({ chat: { completions: { create } } });
    createSession(makeSession("QTEST1"));

    expect(enqueueUtterance("QTEST1", "a", "che cazzo fai", 1000)).toEqual({ maybe: 1 });
    expect(enqueueUtterance("QTEST1", "b", "bel tempo oggi", 1001)).toEqual({ maybe: 0 });
    expect(create).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1600);
    expect(create).toHaveBeenCalledTimes(1);
    const s = getSession("QTEST1")!;
    expect(s.fines).toHaveLength(1);
    expect(s.fines[0].playerId).toBe("a");
    expect(s.fines[0].source).toBe("ai");
    expect(s.aiBusy).toBe(false);
    expect(s.context.a).toEqual(["che cazzo fai"]);
    expect(s.utteranceCounter).toEqual({ a: 1, b: 1 });
  });

  it("marks aiBusy and uses the lexicon when the AI is rate limited", async () => {
    const create = vi.fn(async () => {
      throw Object.assign(new Error("429"), { status: 429 });
    });
    __setAiClientForTests({ chat: { completions: { create } } });
    createSession(makeSession("QTEST2"));
    enqueueUtterance("QTEST2", "a", "che cazzo fai", 1000);
    await vi.advanceTimersByTimeAsync(1600);
    const s = getSession("QTEST2")!;
    expect(s.aiBusy).toBe(true);
    expect(s.fines[0].source).toBe("lexicon");
  });

  it("rejects utterances unless the session is live", () => {
    createSession(makeSession("QTEST3", "lobby"));
    expect(() => enqueueUtterance("QTEST3", "a", "ciao", 1)).toThrow(/not live/);
  });

  it("keeps only the last 3 utterances as context", async () => {
    __setAiClientForTests({ chat: { completions: { create: vi.fn(async () => ({ choices: [{ message: { content: '{"results":[]}' } }] })) } } });
    createSession(makeSession("QTEST4"));
    for (const t of ["uno", "due", "tre", "quattro"]) enqueueUtterance("QTEST4", "a", t, 1);
    expect(getSession("QTEST4")!.context.a).toEqual(["due", "tre", "quattro"]);
    await vi.advanceTimersByTimeAsync(1600);
  });
});
