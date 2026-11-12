import { z } from "zod";
import { compileRules, parseBody } from "@/server/ai";
import { handle, HttpError, mutate, requireCreator } from "@/server/store";

const Body = z.discriminatedUnion("action", [
  z.object({ playerId: z.string(), action: z.literal("recompile"), rulesText: z.string().max(1000) }),
  z.object({ playerId: z.string(), action: z.literal("confirm") }),
]);

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  return handle(async () => {
    const code = (await ctx.params).code.toUpperCase();
    const b = await parseBody(req, Body);
    // Read what the compile needs first; the compile itself awaits outside mutate().
    const { capCents, mode } = mutate(code, (s) => {
      requireCreator(s, b.playerId);
      if (s.status !== "lobby") throw new HttpError(409, "Rules can only change in the lobby");
      return { capCents: s.jar.capCents, mode: s.jar.mode };
    });
    if (b.action === "confirm") {
      return mutate(code, (s) => {
        s.jar.rulesConfirmed = true;
        return { rules: s.jar.rules, rulesConfirmed: true };
      });
    }
    const rules = await compileRules(b.rulesText, capCents, mode);
    return mutate(code, (s) => {
      if (s.status !== "lobby") throw new HttpError(409, "Rules can only change in the lobby");
      s.jar.rulesText = b.rulesText;
      s.jar.rules = rules;
      s.jar.rulesConfirmed = false;
      return { rules, rulesConfirmed: false };
    });
  });
}
