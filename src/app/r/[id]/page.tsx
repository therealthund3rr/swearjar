"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api, errMsg } from "@/lib/client/api";
import { Money } from "@/components/Money";
import { SandboxBadge } from "@/components/SandboxBadge";
import { settleLabel } from "@/components/helpers";
import type { Receipt } from "@/lib/types";

export default function ReceiptPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [r, setR] = useState<Receipt | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Receipt>(`/api/receipts/${encodeURIComponent(id)}`).then(setR, (e) => setError(errMsg(e)));
  }, [id]);

  if (error) {
    return (
      <main className="wrap stack">
        <h1>Receipt not found</h1>
        <p className="muted">{error}</p>
        <Link href="/" className="btn">Home</Link>
      </main>
    );
  }
  if (!r) return <main className="wrap"><p className="muted" role="status">Loading…</p></main>;

  const total = r.lines.reduce((a, l) => a + (l.status === "captured" ? l.amountCents : 0), 0);
  return (
    <main className="wrap stack" style={{ maxWidth: 480 }}>
      <SandboxBadge />
      <div className="card stack">
        <h1 style={{ fontSize: "clamp(2.4rem, 11vw, 3.6rem)" }}>{r.jarName}</h1>
        <p className="muted small">{new Date(r.endedAt).toLocaleString()} · paid to {r.beneficiaryName}</p>
        <div>
          {r.lines.map((l, i) => (
            <div
              key={i}
              style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "2px 12px", alignItems: "center", padding: "10px 0", borderTop: "2.5px dashed var(--ink)" }}
            >
              <div>
                <strong>{l.name}</strong>
                <div className="small muted">{l.fines} {l.fines === 1 ? "fine" : "fines"}</div>
              </div>
              <div style={{ textAlign: "right", display: "grid", justifyItems: "end", gap: 2 }}>
                <span className={`badge ${l.status === "captured" ? "hold" : l.status === "voided" ? "good" : "bad"}`}>
                  {l.status === "voided" ? "Voided" : settleLabel(l.status, l.amountCents, r.currency)}
                </span>
                <Money cents={l.status === "captured" ? l.amountCents : 0} currency={r.currency} />
                {l.captureId && <span className="small muted">{l.captureId}</span>}
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderTop: "4px solid var(--ink)", paddingTop: 12 }}>
          <h2>Total</h2>
          <Money cents={total} currency={r.currency} big />
        </div>
        <p className="muted small">PayPal sandbox. No transcript is stored.</p>
        <p><Link className="btn" href="/">Back to home</Link></p>
      </div>
    </main>
  );
}
