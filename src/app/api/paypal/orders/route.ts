import { z } from "zod";
import { env } from "@/lib/env";
import { HttpError, handle, mutate, requirePlayer } from "@/server/store";
import { paypal } from "@/server/paypal";

const Body = z.object({ code: z.string().min(1), playerId: z.string().min(1) });

export async function POST(req: Request) {
  return handle(async () => {
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "code and playerId are required");
    const { code, playerId } = parsed.data;

    // Validate and compute the amount synchronously, before any network call.
    const plan = mutate(code, (s) => {
      const p = requirePlayer(s, playerId);
      if (p.sponsorId !== null) throw new HttpError(400, "Sponsored players do not pay themselves");
      if (!s.jar.rulesConfirmed) throw new HttpError(409, "Rules are not confirmed yet");
      if (s.status !== "lobby" && s.status !== "live") throw new HttpError(409, "Session is closed");
      const hs = p.hold?.status;
      if (hs === "on_hold" || hs === "captured" || hs === "voided") throw new HttpError(409, "Hold already exists");
      const sponsored = Object.values(s.players).filter((x) => x.sponsorId === p.id).length;
      const amountCents = s.jar.capCents * (1 + sponsored);
      const reuse = p.hold?.status === "pending" && p.hold.orderId && p.hold.amountCents === amountCents ? p.hold.orderId : null;
      return { amountCents, reuse, currency: s.jar.currency, jarName: s.jar.name, payeeEmail: s.jar.beneficiaryEmail ?? env().beneficiaryEmail };
    });
    if (plan.reuse) return { orderId: plan.reuse };

    const { orderId } = await paypal.createAuthorizeOrder({
      amountCents: plan.amountCents,
      currency: plan.currency,
      payeeEmail: plan.payeeEmail,
      description: `Swear Jar "${plan.jarName}" hold`,
      // amount in the key: a changed hold (new sponsored player) must not replay an old order
      requestId: `${code}:${playerId}:create-order:${plan.amountCents}`,
    });

    mutate(code, (s) => {
      const p = requirePlayer(s, playerId);
      const hs = p.hold?.status;
      if (hs === "on_hold" || hs === "captured" || hs === "voided") throw new HttpError(409, "Hold already exists");
      p.hold = { orderId, authorizationId: null, amountCents: plan.amountCents, status: "pending" };
    });
    return { orderId };
  });
}
