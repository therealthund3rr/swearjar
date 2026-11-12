import { z } from "zod";
import { resolveObjections, VOTE_TIMEOUT_MS } from "@/lib/fines";
import { parseBody } from "@/server/ai";
import { ensureResolver } from "@/server/judge-queue";
import { handle, HttpError, mutate, requirePlayer } from "@/server/store";

const Body = z.discriminatedUnion("action", [
  z.object({ playerId: z.string(), fineId: z.string(), action: z.literal("object") }),
  z.object({ playerId: z.string(), fineId: z.string(), action: z.literal("vote"), vote: z.enum(["keep", "drop"]) }),
]);

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  return handle(async () => {
    const code = (await ctx.params).code.toUpperCase();
    const b = await parseBody(req, Body);
    mutate(code, (s) => {
      requirePlayer(s, b.playerId);
      if (s.status !== "live") throw new HttpError(409, "The session is not live");
      const fine = s.fines.find((f) => f.id === b.fineId);
      if (!fine) throw new HttpError(404, "Fine not found");
      const now = Date.now();
      if (b.action === "object") {
        if (fine.status === "dropped") throw new HttpError(409, "This fine was already dropped");
        if (fine.objection) throw new HttpError(409, "There is already an objection on this fine");
        if (now > fine.objectableUntil) throw new HttpError(409, "The objection window has closed");
        // Objecting to someone else's fine is also a "drop" vote; otherwise a 2-player jar always ties.
        const votes: Record<string, "keep" | "drop"> = b.playerId !== fine.playerId ? { [b.playerId]: "drop" } : {};
        fine.objection = { byPlayerId: b.playerId, votes, deadline: now + VOTE_TIMEOUT_MS };
        fine.status = "contested";
        s.fines = resolveObjections(s.fines, Object.keys(s.players), now, false);
        return;
      }
      if (fine.status !== "contested" || !fine.objection) throw new HttpError(409, "This fine is not being contested");
      const ids = Object.keys(s.players);
      // The accused never votes on their own fine, except when they are alone in the jar.
      if (b.playerId === fine.playerId && ids.length > 1) throw new HttpError(403, "You cannot vote on your own fine");
      fine.objection.votes[b.playerId] = b.vote;
      s.fines = resolveObjections(s.fines, ids, now, false);
    });
    ensureResolver(code); // so an unanswered vote still times out
    return { ok: true };
  });
}
