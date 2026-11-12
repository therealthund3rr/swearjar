import "server-only";
import { env } from "@/lib/env";
import { fromPayPalValue, toPayPalValue, type Cents } from "@/lib/money";

/** PayPal API failure. Carries only status + debug id + names, never tokens or secrets. */
export class PayPalError extends Error {
  constructor(
    public status: number,
    public debugId: string | null,
    public name_: string,
    message: string,
    public issues: string[] = [],
  ) {
    super(`PayPal ${status} ${name_}: ${message}${debugId ? ` (debug_id ${debugId})` : ""}`);
    this.name = "PayPalError";
  }
}

export type PayPalClient = {
  createAuthorizeOrder: typeof createAuthorizeOrder;
  authorizeOrder: typeof authorizeOrder;
  captureAuthorization: typeof captureAuthorization;
  voidAuthorization: typeof voidAuthorization;
};

const TIMEOUT_MS = 15_000;

let tokenCache: { token: string; expiresAt: number } | null = null;

/** Test helper: forget the cached OAuth token. */
export function resetPayPalTokenCache() {
  tokenCache = null;
}

async function getToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) return tokenCache.token;
  const { paypalClientId, paypalClientSecret, paypalApiBase } = env();
  if (!paypalClientId || !paypalClientSecret) throw new PayPalError(500, null, "NOT_CONFIGURED", "PayPal credentials are not set");
  const basic = Buffer.from(`${paypalClientId}:${paypalClientSecret}`).toString("base64");
  const res = await fetch(`${paypalApiBase}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const json = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number };
  if (!res.ok || !json.access_token) {
    throw new PayPalError(res.status, res.headers.get("paypal-debug-id"), "AUTH_FAILED", "Could not get an access token");
  }
  // Refresh 60 s early so a token never expires mid-request.
  tokenCache = { token: json.access_token, expiresAt: Date.now() + Math.max(0, (json.expires_in ?? 300) - 60) * 1000 };
  return json.access_token;
}

type Raw = { status: number; json: any }; // eslint-disable-line @typescript-eslint/no-explicit-any

async function call(method: "GET" | "POST", path: string, opts: { body?: unknown; requestId?: string } = {}): Promise<Raw> {
  const token = await getToken();
  const headers: Record<string, string> = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  if (method === "POST") {
    if (opts.requestId) headers["PayPal-Request-Id"] = opts.requestId; // idempotency key
    headers["Prefer"] = "return=representation";
  }
  const res = await fetch(`${env().paypalApiBase}${path}`, {
    method,
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await res.text();
  let json: any = null; // eslint-disable-line @typescript-eslint/no-explicit-any
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (res.status === 401) tokenCache = null; // next call fetches a fresh token
  if (!res.ok) {
    const issues: string[] = Array.isArray(json?.details) ? json.details.map((d: { issue?: string }) => String(d.issue ?? "")) : [];
    throw new PayPalError(
      res.status,
      res.headers.get("paypal-debug-id") ?? json?.debug_id ?? null,
      String(json?.name ?? "HTTP_ERROR"),
      String(json?.message ?? res.statusText ?? "request failed").slice(0, 200),
      issues,
    );
  }
  return { status: res.status, json };
}

function extractAuthorization(order: any): { authorizationId: string; amountCents: Cents; status: string } { // eslint-disable-line @typescript-eslint/no-explicit-any
  const auth = order?.purchase_units?.[0]?.payments?.authorizations?.[0];
  if (!auth?.id || !auth?.amount?.value) throw new PayPalError(502, null, "NO_AUTHORIZATION", "Order has no authorization");
  return { authorizationId: String(auth.id), amountCents: fromPayPalValue(String(auth.amount.value)), status: String(auth.status ?? "") };
}

export async function createAuthorizeOrder(a: {
  amountCents: Cents;
  currency: string;
  payeeEmail: string | null;
  description: string;
  requestId: string;
}): Promise<{ orderId: string }> {
  const unit: Record<string, unknown> = {
    amount: { currency_code: a.currency, value: toPayPalValue(a.amountCents) },
    description: a.description.slice(0, 127),
  };
  if (a.payeeEmail) unit.payee = { email_address: a.payeeEmail };
  const { json } = await call("POST", "/v2/checkout/orders", {
    requestId: a.requestId,
    body: { intent: "AUTHORIZE", purchase_units: [unit] },
  });
  if (!json?.id) throw new PayPalError(502, null, "NO_ORDER_ID", "PayPal returned no order id");
  return { orderId: String(json.id) };
}

export async function authorizeOrder(
  orderId: string,
  requestId: string,
): Promise<{ authorizationId: string; amountCents: Cents; status: string }> {
  const path = `/v2/checkout/orders/${encodeURIComponent(orderId)}`;
  try {
    const { json } = await call("POST", `${path}/authorize`, { requestId, body: {} });
    return extractAuthorization(json);
  } catch (err) {
    // Double click / retry after the first call succeeded: return the authorization that already exists.
    if (err instanceof PayPalError && err.status === 422 && err.issues.includes("ORDER_ALREADY_AUTHORIZED")) {
      const { json } = await call("GET", path);
      return extractAuthorization(json);
    }
    throw err;
  }
}

export async function captureAuthorization(
  authId: string,
  a: { amountCents: Cents; currency: string; requestId: string },
): Promise<{ captureId: string; status: string; amountCents: Cents }> {
  const { json } = await call("POST", `/v2/payments/authorizations/${encodeURIComponent(authId)}/capture`, {
    requestId: a.requestId,
    // final_capture releases whatever is left of the hold right away.
    body: { amount: { currency_code: a.currency, value: toPayPalValue(a.amountCents) }, final_capture: true },
  });
  if (!json?.id) throw new PayPalError(502, null, "NO_CAPTURE_ID", "PayPal returned no capture id");
  return {
    captureId: String(json.id),
    status: String(json.status ?? ""),
    amountCents: json.amount?.value ? fromPayPalValue(String(json.amount.value)) : a.amountCents,
  };
}

export async function voidAuthorization(authId: string, requestId: string): Promise<void> {
  try {
    await call("POST", `/v2/payments/authorizations/${encodeURIComponent(authId)}/void`, { requestId });
  } catch (err) {
    // Already voided (retry after a lost response): the goal state is reached.
    if (err instanceof PayPalError && err.status === 422 && err.issues.includes("AUTHORIZATION_VOIDED")) return;
    throw err;
  }
}

export const paypal: PayPalClient = { createAuthorizeOrder, authorizeOrder, captureAuthorization, voidAuthorization };
