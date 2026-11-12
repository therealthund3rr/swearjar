import { aiMode, env } from "@/lib/env";

export const dynamic = "force-dynamic";

// Public values only: the client ID is meant for the browser (JS SDK); the secret never leaves the server.
export function GET() {
  const e = env();
  return Response.json({
    paypalClientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || e.paypalClientId,
    currency: e.currency,
    beneficiaryName: e.beneficiaryName,
    aiMode: aiMode(),
  });
}
