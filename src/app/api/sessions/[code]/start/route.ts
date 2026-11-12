import { z } from "zod";
import { handle, HttpError, mutate, requireCreator } from "@/server/store";

const Body = z.object({ playerId: z.string() });

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return handle(async () => {
    const { playerId } = Body.parse(await req.json());
    return mutate(code, (s) => {
      requireCreator(s, playerId);
      if (s.status === "live") return { ok: true };
      if (s.status !== "lobby") throw new HttpError(409, "Session already ended");
      if (!s.jar.rulesConfirmed) throw new HttpError(409, "Confirm the house rules first");
      // Every paying player must have a hold: a fine on a player without an authorization could never be collected.
      const missing = Object.values(s.players).filter((p) => p.sponsorId === null && p.hold?.status !== "on_hold");
      if (missing.length > 0)
        throw new HttpError(409, `Waiting for PayPal holds: ${missing.map((p) => p.name).join(", ")}`);
      s.status = "live";
      s.startedAt = Date.now();
      return { ok: true };
    });
  });
}
