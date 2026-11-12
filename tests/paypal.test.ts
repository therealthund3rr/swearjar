import { beforeEach, describe, expect, it, vi } from "vitest";
import { authorizeOrder, captureAuthorization, createAuthorizeOrder, PayPalError, resetPayPalTokenCache, voidAuthorization } from "@/server/paypal";

const SECRET = "super-secret-value";
type Call = { url: string; init: RequestInit };
let calls: Call[];
let handler: (url: string, init: RequestInit) => Response;

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

beforeEach(() => {
  process.env.PAYPAL_CLIENT_ID = "cid";
  process.env.PAYPAL_CLIENT_SECRET = SECRET;
  process.env.PAYPAL_API_BASE = "https://pp.test";
  resetPayPalTokenCache();
  calls = [];
  handler = () => json({});
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      if (url.endsWith("/v1/oauth2/token")) return json({ access_token: "tok-123", expires_in: 3600 });
      return handler(url, init);
    }),
  );
});

const hdr = (c: Call, k: string) => (c.init.headers as Record<string, string>)[k];
const api = () => calls.filter((c) => !c.url.endsWith("/v1/oauth2/token"));

describe("paypal client", () => {
  it("captures with a decimal string, final_capture and idempotency headers", async () => {
    handler = () => json({ id: "CAP1", status: "COMPLETED", amount: { value: "2.75", currency_code: "USD" } }, 201);
    const r = await captureAuthorization("AUTH1", { amountCents: 275, currency: "USD", requestId: "J:p:capture" });
    expect(r).toEqual({ captureId: "CAP1", status: "COMPLETED", amountCents: 275 });
    const c = api()[0];
    expect(c.url).toBe("https://pp.test/v2/payments/authorizations/AUTH1/capture");
    expect(JSON.parse(c.init.body as string)).toEqual({ amount: { currency_code: "USD", value: "2.75" }, final_capture: true });
    expect(hdr(c, "PayPal-Request-Id")).toBe("J:p:capture");
    expect(hdr(c, "Prefer")).toBe("return=representation");
    expect(hdr(c, "Authorization")).toBe("Bearer tok-123");
  });

  it("formats boundary amounts", async () => {
    handler = () => json({ id: "C", status: "COMPLETED" }, 201);
    for (const [cents, v] of [[1, "0.01"], [100, "1.00"], [1050, "10.50"]] as const) {
      await captureAuthorization("A", { amountCents: cents, currency: "USD", requestId: "r" });
      expect(JSON.parse(api().at(-1)!.init.body as string).amount.value).toBe(v);
    }
  });

  it("caches the token", async () => {
    handler = () => json({ id: "C", status: "COMPLETED" }, 201);
    await captureAuthorization("A", { amountCents: 1, currency: "USD", requestId: "r" });
    await captureAuthorization("A", { amountCents: 1, currency: "USD", requestId: "r" });
    expect(calls.filter((c) => c.url.endsWith("/token")).length).toBe(1);
  });

  it("creates an order with payee only when given", async () => {
    handler = () => json({ id: "ORD1" }, 201);
    await createAuthorizeOrder({ amountCents: 500, currency: "EUR", payeeEmail: "b@x.test", description: "d", requestId: "r1" });
    await createAuthorizeOrder({ amountCents: 500, currency: "EUR", payeeEmail: null, description: "d", requestId: "r2" });
    const [a, b] = api().map((c) => JSON.parse(c.init.body as string));
    expect(a.intent).toBe("AUTHORIZE");
    expect(a.purchase_units[0].amount).toEqual({ currency_code: "EUR", value: "5.00" });
    expect(a.purchase_units[0].payee).toEqual({ email_address: "b@x.test" });
    expect(b.purchase_units[0].payee).toBeUndefined();
  });

  it("reads the authorization from the order", async () => {
    handler = () => json({ purchase_units: [{ payments: { authorizations: [{ id: "AU9", status: "CREATED", amount: { value: "10.00" } }] } }] });
    expect(await authorizeOrder("ORD1", "r")).toEqual({ authorizationId: "AU9", amountCents: 1000, status: "CREATED" });
  });

  it("returns the existing authorization on ORDER_ALREADY_AUTHORIZED", async () => {
    handler = (_u, init) =>
      init.method === "GET"
        ? json({ purchase_units: [{ payments: { authorizations: [{ id: "AU9", status: "CREATED", amount: { value: "10.00" } }] } }] })
        : json({ name: "UNPROCESSABLE_ENTITY", details: [{ issue: "ORDER_ALREADY_AUTHORIZED" }] }, 422);
    expect((await authorizeOrder("ORD1", "r")).authorizationId).toBe("AU9");
  });

  it("void treats 204 and already-voided as success", async () => {
    handler = () => new Response(null, { status: 204 });
    await expect(voidAuthorization("A", "r")).resolves.toBeUndefined();
    handler = () => json({ details: [{ issue: "AUTHORIZATION_VOIDED" }] }, 422);
    await expect(voidAuthorization("A", "r")).resolves.toBeUndefined();
  });

  it("errors carry the debug id and never secrets or tokens", async () => {
    handler = () => json({ name: "INTERNAL", message: "boom" }, 500, { "paypal-debug-id": "dbg1" });
    const err = await captureAuthorization("A", { amountCents: 1, currency: "USD", requestId: "r" }).catch((e) => e);
    expect(err).toBeInstanceOf(PayPalError);
    expect(err.status).toBe(500);
    expect(err.message).toContain("dbg1");
    expect(err.message).not.toContain(SECRET);
    expect(err.message).not.toContain("tok-123");
  });
});
