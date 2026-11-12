import { aiMode, env, paypalConfigured } from "@/lib/env";
import { handle } from "@/server/store";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(() => {
    const mode = aiMode();
    return { ok: true, ai: mode, model: mode === "lexicon" ? null : env().aiModelFast, paypal: paypalConfigured(), currency: env().currency };
  });
}
