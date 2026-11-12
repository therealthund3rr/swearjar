import { z } from "zod";
import { aiMode, env } from "@/lib/env";
import type { Session } from "@/lib/types";
import { compileRules, parseBody } from "@/server/ai";
import { createSession, getSession, handle, newId, newJarCode } from "@/server/store";

const Body = z.object({
  name: z.string().trim().min(1).max(40),
  mode: z.enum(["party", "family"]),
  capCents: z.number().int().min(100).max(5000),
  rulesText: z.string().max(1000).default(""),
  creatorName: z.string().trim().min(1).max(24),
  creatorLang: z.string().min(2).max(16),
  beneficiaryEmail: z.string().max(120).optional(),
});

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  return handle(async () => {
    const b = await parseBody(req, Body);
    const rules = await compileRules(b.rulesText, b.capCents, b.mode);
    let code = newJarCode();
    for (let i = 0; getSession(code) && i < 20; i++) code = newJarCode();
    const e = env();
    const playerId = newId();
    const now = Date.now();
    const email = b.beneficiaryEmail?.trim();
    const session: Session = {
      jar: {
        code,
        name: b.name,
        mode: b.mode,
        capCents: b.capCents,
        currency: e.currency,
        beneficiaryEmail: email && EMAIL.test(email) ? email : e.beneficiaryEmail,
        beneficiaryName: e.beneficiaryName,
        rulesText: b.rulesText,
        rules,
        rulesConfirmed: false,
        creatorPlayerId: playerId,
        createdAt: now,
      },
      status: "lobby",
      players: {
        [playerId]: { id: playerId, name: b.creatorName, lang: b.creatorLang, isCreator: true, sponsorId: null, hold: null, joinedAt: now },
      },
      fines: [],
      utteranceCounter: {},
      context: {},
      activeMultiplierId: null,
      aiBusy: false,
      startedAt: null,
      endedAt: null,
      reports: {},
      settle: {},
      receiptId: null,
    };
    createSession(session);
    return { code, playerId, rules, aiMode: aiMode() };
  });
}
