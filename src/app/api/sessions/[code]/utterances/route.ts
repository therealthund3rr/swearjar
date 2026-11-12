import { z } from "zod";
import { parseBody } from "@/server/ai";
import { enqueueUtterance } from "@/server/judge-queue";
import { getSession, handle, HttpError, requirePlayer } from "@/server/store";

const Body = z.object({
  playerId: z.string(),
  text: z.string().trim().min(1).max(500),
  ts: z.number().finite(),
});

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  return handle(async () => {
    const code = (await ctx.params).code.toUpperCase();
    const b = await parseBody(req, Body);
    // Any player may speak, sponsored ones included, but only with a live hold behind them:
    // a fine without an authorization could never be collected.
    const s = getSession(code);
    if (!s) throw new HttpError(404, "Jar not found");
    const p = requirePlayer(s, b.playerId);
    const payer = p.sponsorId ? s.players[p.sponsorId] : p;
    if (payer?.hold?.status !== "on_hold") throw new HttpError(409, "Approve your PayPal hold first");
    const { maybe } = enqueueUtterance(code, b.playerId, b.text, b.ts);
    return { accepted: true, maybe };
  });
}
