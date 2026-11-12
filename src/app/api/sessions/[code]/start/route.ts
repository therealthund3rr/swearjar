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
      if (!Object.values(s.players).some((p) => p.hold?.status === "on_hold"))
        throw new HttpError(409, "At least one player needs a PayPal hold");
      s.status = "live";
      s.startedAt = Date.now();
      return { ok: true };
    });
  });
}
