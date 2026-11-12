"use client";
import { useState } from "react";
import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import { api, errMsg } from "@/lib/client/api";
import { SandboxBadge } from "./SandboxBadge";

/** PayPal authorization hold: create order -> buyer approves -> server authorizes. */
export function PayPalHoldButton({
  clientId,
  currency,
  code,
  playerId,
  onApproved,
}: {
  clientId: string;
  currency: string;
  code: string;
  playerId: string;
  onApproved: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!clientId) {
    return <p className="error">PayPal is not configured on this server (missing client ID).</p>;
  }
  return (
    <div className="stack">
      <SandboxBadge />
      <PayPalScriptProvider options={{ clientId, currency, intent: "authorize" }}>
        <PayPalButtons
          style={{ layout: "vertical", label: "pay" }}
          disabled={busy}
          createOrder={async () => {
            setError(null);
            const r = await api<{ orderId: string }>("/api/paypal/orders", { code, playerId });
            return r.orderId;
          }}
          onApprove={async (data) => {
            setBusy(true);
            try {
              await api(`/api/paypal/orders/${data.orderID}/authorize`, { code, playerId });
              onApproved();
            } catch (e) {
              setError(errMsg(e));
            } finally {
              setBusy(false);
            }
          }}
          onError={(e) => setError(errMsg(e))}
          onCancel={() => setError("Hold cancelled. You can try again.")}
        />
      </PayPalScriptProvider>
      {busy && <p className="muted">Confirming your hold with PayPal…</p>}
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}
