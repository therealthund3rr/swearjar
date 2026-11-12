import { z } from "zod";
import { HttpError, handle, mutate, requirePlayer } from "@/server/store";
import { paypal } from "@/server/paypal";

const Body = z.object({ code: z.string().min(1), playerId: z.string().min(1) });

export async function POST(req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  return handle(async () => {
    const { orderId } = await params;
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "code and playerId are required");
    const { code, playerId } = parsed.data;

    const plan = mutate(code, (s) => {
      const p = requirePlayer(s, playerId);
      const h = p.hold;
      if (!h || h.orderId !== orderId) throw new HttpError(409, "Order does not belong to this player");
      if (s.status !== "lobby" && s.status !== "live") throw new HttpError(409, "Session is closed");
      if (h.status === "on_hold") return { done: { status: "on_hold" as const, authorizationId: h.authorizationId!, amountCents: h.amountCents } };
      if (h.status !== "pending") throw new HttpError(409, `Hold is ${h.status}`);
      return { amountCents: h.amountCents };
    });
    if ("done" in plan) return plan.done;

    const auth = await paypal.authorizeOrder(orderId, `${code}:${playerId}:authorize:${orderId}`);
    if (auth.amountCents !== plan.amountCents) {
      // Never accept a hold that differs from the approved amount; release the stray authorization.
      await paypal.voidAuthorization(auth.authorizationId, `${code}:${playerId}:void-stray:${auth.authorizationId}`).catch(() => undefined);
      throw new HttpError(409, "Authorized amount does not match the expected hold");
    }

    return mutate(code, (s) => {
      const h = requirePlayer(s, playerId).hold;
      if (!h || h.orderId !== orderId) throw new HttpError(409, "Order does not belong to this player");
      h.status = "on_hold";
      h.authorizationId = auth.authorizationId;
      return { status: "on_hold" as const, authorizationId: auth.authorizationId, amountCents: h.amountCents };
    });
  });
}
