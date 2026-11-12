import { z } from "zod";
import { handle, HttpError, mutate, newId } from "@/server/store";

const Body = z.object({
  name: z.string().trim().min(1).max(24),
  lang: z.string().min(2).max(12),
  sponsorId: z.string().optional().nullable(),
});

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return handle(async () => {
    const body = Body.parse(await req.json());
    return mutate(code, (s) => {
      if (s.status === "settling" || s.status === "ended") throw new HttpError(409, "This jar is closed");
      const sponsorId = body.sponsorId ?? null;
      if (sponsorId) {
        // Family mode: minors have no PayPal, a parent's hold covers them. Must be added before the parent's hold.
        if (s.jar.mode !== "family") throw new HttpError(400, "Sponsored players exist only in Family mode");
        const sponsor = s.players[sponsorId];
        if (!sponsor || sponsor.sponsorId) throw new HttpError(400, "Invalid sponsor");
        if (sponsor.hold && sponsor.hold.status !== "pending") throw new HttpError(409, "Add sponsored players before the hold");
        if (sponsor.hold?.status === "pending") sponsor.hold = null; // order amount changes: a new order is needed
      }
      const id = newId();
      s.players[id] = { id, name: body.name, lang: body.lang, isCreator: false, sponsorId, hold: null, joinedAt: Date.now() };
      return { playerId: id };
    });
  });
}
