import { z } from "zod";
import { parseBody } from "@/server/ai";
import { handle, HttpError, mutate, requireCreator } from "@/server/store";

const Body = z.object({ playerId: z.string(), multiplierId: z.string().nullable() });

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  return handle(async () => {
    const code = (await ctx.params).code.toUpperCase();
    const b = await parseBody(req, Body);
    mutate(code, (s) => {
      requireCreator(s, b.playerId);
      if (b.multiplierId !== null && !s.jar.rules.multipliers.some((m) => m.id === b.multiplierId)) {
        throw new HttpError(400, "Unknown multiplier");
      }
      s.activeMultiplierId = b.multiplierId;
    });
    return { ok: true };
  });
}
