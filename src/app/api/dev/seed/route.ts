import { defaultRuleSet } from "@/lib/rules";
import type { Session } from "@/lib/types";
import { env } from "@/lib/env";
import { createSession, handle, HttpError, newId, newJarCode } from "@/server/store";

// Dev-only fixture for the screenshot script (CLAUDE.md §11.2): a live session with FAKE holds.
// It never touches PayPal and is disabled in production.
export async function POST(req: Request) {
  return handle(async () => {
    if (env().isProd) throw new HttpError(404, "Not found");
    const body = (await req.json().catch(() => ({}))) as { ended?: boolean; mode?: "party" | "family" };
    const now = Date.now();
    const code = newJarCode();
    const a = newId();
    const b = newId();
    const cap = 1500;
    const hold = (id: string) => ({ orderId: `SEED-ORDER-${id}`, authorizationId: `SEED-AUTH-${id}`, amountCents: cap, status: "on_hold" as const });
    const s: Session = {
      jar: {
        code,
        name: "Friday FIFA night",
        mode: body.mode ?? "party",
        capCents: cap,
        currency: env().currency,
        beneficiaryEmail: null,
        beneficiaryName: "Pizza fund (sandbox)",
        rulesText: "Mild swears 25 cents, strong swears $1, blasphemy $2, 'fudge' is free, double during penalty kicks",
        rules: { ...defaultRuleSet(cap), free_terms: ["fudge"], multipliers: [{ id: "penalty", when: "During a penalty kick", factor: 2 }] },
        rulesConfirmed: true,
        creatorPlayerId: a,
        createdAt: now,
      },
      status: "live",
      players: {
        [a]: { id: a, name: "Nico", lang: "en-US", isCreator: true, sponsorId: null, hold: hold(a), joinedAt: now },
        [b]: { id: b, name: "Ale", lang: "en-US", isCreator: false, sponsorId: null, hold: hold(b), joinedAt: now },
      },
      fines: [],
      utteranceCounter: {},
      context: {},
      activeMultiplierId: null,
      aiBusy: false,
      startedAt: now,
      endedAt: null,
      reports: {},
      settle: {},
      receiptId: null,
    };
    if (body.ended) {
      s.status = "ended";
      s.endedAt = now;
      s.players[a].hold = { ...hold(a), status: "captured", captureId: "SEED-CAPTURE-1", capturedCents: 275 };
      s.players[b].hold = { ...hold(b), status: "voided", voidedAt: now };
      s.settle = {
        [a]: { playerId: a, status: "captured", amountCents: 275, captureId: "SEED-CAPTURE-1" },
        [b]: { playerId: b, status: "voided", amountCents: 0 },
      };
      s.reports = {
        [a]: { title: "The Sailor", summary: "Three fines, one of them hidden behind asterisks.", mostUsed: "f**k", alternatives: ["fudge", "shoot"] },
        [b]: { title: "The Diplomat", summary: "Not a single fine. The pizza is on the others.", mostUsed: null, alternatives: [] },
      };
    }
    createSession(s);
    return { code, playerIds: [a, b] };
  });
}
