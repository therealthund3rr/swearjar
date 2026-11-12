import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/fines", () => ({
  owedCents: (id: string, fines: { playerId: string; status: string; priceCents: number }[], cap: number) =>
    Math.min(fines.filter((f) => f.playerId === id && f.status !== "dropped").reduce((a, f) => a + f.priceCents, 0), cap),
  resolveObjections: (f: unknown[]) => f,
}));

import { createSession, getReceipt, getSession } from "@/server/store";
import { settleSession } from "@/server/settle";
import type { PayPalClient } from "@/server/paypal";
import type { Fine, Player, Session } from "@/lib/types";

let n = 0;
const player = (id: string, over: Partial<Player> = {}): Player => ({
  id, name: id, lang: "en-US", isCreator: false, sponsorId: null, joinedAt: 0,
  hold: { orderId: "O" + id, authorizationId: "AU" + id, amountCents: 1000, status: "on_hold" },
  ...over,
});
const fine = (playerId: string, priceCents: number): Fine =>
  ({ id: "f" + n++, playerId, priceCents, status: "active" }) as unknown as Fine;

function setup(players: Player[], fines: Fine[]): string {
  const code = "T" + String(++n).padStart(5, "0");
  createSession({
    jar: { code, name: "Jar", mode: "family", capCents: 1000, currency: "USD", beneficiaryEmail: null, beneficiaryName: "Charity", rulesText: "", rules: {} as never, rulesConfirmed: true, creatorPlayerId: players[0].id, createdAt: 0 },
    status: "live", players: Object.fromEntries(players.map((p) => [p.id, p])), fines,
    utteranceCounter: {}, context: {}, activeMultiplierId: null, aiBusy: false, startedAt: 1, endedAt: null, reports: {}, settle: {}, receiptId: null,
  } as Session);
  return code;
}

const mockClient = () => {
  const c = {
    createAuthorizeOrder: vi.fn(),
    authorizeOrder: vi.fn(),
    captureAuthorization: vi.fn(async (_id: string, a: { amountCents: number }) => ({ captureId: "CAP", status: "COMPLETED", amountCents: a.amountCents })),
    voidAuthorization: vi.fn(async () => undefined),
  };
  return c as unknown as typeof c & PayPalClient;
};

describe("settleSession", () => {
  let client: ReturnType<typeof mockClient>;
  beforeEach(() => { client = mockClient(); });

  it("captures what is owed and voids a clean player", async () => {
    const code = setup([player("a"), player("b")], [fine("a", 275)]);
    const res = await settleSession(code, { paypal: client });
    expect(client.captureAuthorization).toHaveBeenCalledTimes(1);
    expect(client.captureAuthorization).toHaveBeenCalledWith("AUa", { amountCents: 275, currency: "USD", requestId: `${code}:a:AUa:capture` });
    expect(client.voidAuthorization).toHaveBeenCalledWith("AUb", `${code}:b:AUb:void`);
    expect(res.find((r) => r.playerId === "a")).toMatchObject({ status: "captured", amountCents: 275 });
    expect(res.find((r) => r.playerId === "b")).toMatchObject({ status: "voided", amountCents: 0 });
    const s = getSession(code)!;
    expect(s.status).toBe("ended");
    expect(getReceipt(s.receiptId!)!.lines).toHaveLength(2);
  });

  it("adds sponsored players fines to the parent capture", async () => {
    const code = setup(
      [player("p", { hold: { orderId: "O", authorizationId: "AUp", amountCents: 2000, status: "on_hold" } }), player("k", { sponsorId: "p", hold: null })],
      [fine("p", 100), fine("k", 250)],
    );
    await settleSession(code, { paypal: client });
    expect(client.captureAuthorization.mock.calls[0][1].amountCents).toBe(350);
  });

  it("clamps owed to the hold", async () => {
    const code = setup([player("a", { hold: { orderId: "O", authorizationId: "AUa", amountCents: 300, status: "on_hold" } })], [fine("a", 1000)]);
    await settleSession(code, { paypal: client });
    expect(client.captureAuthorization.mock.calls[0][1].amountCents).toBe(300);
  });

  it("does not call PayPal again on a second settle", async () => {
    const code = setup([player("a"), player("b")], [fine("a", 100)]);
    const first = await settleSession(code, { paypal: client });
    const second = await settleSession(code, { paypal: client });
    expect(client.captureAuthorization).toHaveBeenCalledTimes(1);
    expect(client.voidAuthorization).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
  });

  it("shares one run between concurrent calls", async () => {
    const code = setup([player("a")], [fine("a", 100)]);
    await Promise.all([settleSession(code, { paypal: client }), settleSession(code, { paypal: client })]);
    expect(client.captureAuthorization).toHaveBeenCalledTimes(1);
  });

  it("marks a failed capture, continues, and retries only the failed one", async () => {
    const code = setup([player("a"), player("b")], [fine("a", 100)]);
    client.captureAuthorization.mockRejectedValueOnce(new Error("PayPal 500 INTERNAL: boom"));
    const res = await settleSession(code, { paypal: client });
    expect(res.find((r) => r.playerId === "a")).toMatchObject({ status: "settle_failed", error: expect.stringContaining("boom") });
    expect(res.find((r) => r.playerId === "b")!.status).toBe("voided");
    expect(getSession(code)!.status).toBe("settling");

    const retry = await settleSession(code, { paypal: client });
    expect(client.captureAuthorization).toHaveBeenCalledTimes(2);
    expect(client.voidAuthorization).toHaveBeenCalledTimes(1);
    expect(retry.find((r) => r.playerId === "a")).toMatchObject({ status: "captured", amountCents: 100 });
    expect(getSession(code)!.status).toBe("ended");
  });
});
