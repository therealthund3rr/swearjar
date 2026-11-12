import "server-only";
import type { AiMode } from "./types";

// Server env. Read lazily so `next build` works without secrets.
export function env() {
  const e = process.env;
  return {
    paypalClientId: e.PAYPAL_CLIENT_ID ?? "",
    paypalClientSecret: e.PAYPAL_CLIENT_SECRET ?? "",
    paypalApiBase: e.PAYPAL_API_BASE || "https://api-m.sandbox.paypal.com",
    currency: (e.CURRENCY || "USD").toUpperCase(),
    beneficiaryEmail: e.BENEFICIARY_EMAIL || null,
    beneficiaryName: e.BENEFICIARY_NAME || "Swear Jar Charity (sandbox)",
    aiBaseUrl: e.AI_BASE_URL || "",
    aiApiKey: e.AI_API_KEY || "",
    aiModelFast: e.AI_MODEL_FAST || "openai/gpt-oss-20b",
    aiModelSmart: e.AI_MODEL_SMART || "openai/gpt-oss-120b",
    appUrl: e.APP_URL || "http://localhost:3000",
    dataDir: e.DATA_DIR || "./.data",
    isProd: e.NODE_ENV === "production",
  };
}

export function aiMode(): AiMode {
  const { aiBaseUrl, aiApiKey } = env();
  if (!aiBaseUrl || !aiApiKey) return "lexicon";
  if (aiBaseUrl.includes("api.groq.com")) return "groq";
  if (/localhost|127\.0\.0\.1/.test(aiBaseUrl)) return "local";
  return "custom";
}

export function paypalConfigured(): boolean {
  const { paypalClientId, paypalClientSecret } = env();
  return Boolean(paypalClientId && paypalClientSecret);
}
