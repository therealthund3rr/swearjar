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
      <main className="wrap stack center">
        <h1>Receipt not found</h1>
        <p className="muted">{error}</p>
        <Link href="/" className="btn">Home</Link>
      </main>
    );
  }
  if (!r) return <main className="wrap"><p className="muted" role="status">Loading…</p></main>;

  const total = r.lines.reduce((a, l) => a + (l.status === "captured" ? l.amountCents : 0), 0);
  return (
    <main className="wrap stack">
      <div className="row between">
        <h1>Receipt</h1>
        <SandboxBadge />
      </div>
      <div className="card stack">
        <h2>{r.jarName}</h2>
        <p className="muted">
          {r.mode === "family" ? "🏡 Family" : "🍕 Party"} · paid to {r.beneficiaryName} · {new Date(r.endedAt).toLocaleString()}
        </p>
        <table className="rules">
          <thead>
            <tr>
              <th>Player</th>
              <th>Status</th>
              <th>Fines</th>
              <th style={{ textAlign: "right" }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {r.lines.map((l, i) => (
              <tr key={i}>
                <td><strong>{l.name}</strong></td>
                <td>
                  {settleLabel(l.status, l.amountCents, r.currency)}
                  {l.captureId && <div className="mono small muted">{l.captureId}</div>}
                </td>
                <td>{l.fines}</td>
                <td style={{ textAlign: "right" }}>
                  <Money cents={l.status === "captured" ? l.amountCents : 0} currency={r.currency} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="row between">
          <strong>Total captured</strong>
          <Money cents={total} currency={r.currency} big />
        </div>
        <p className="muted small">Only amounts and statuses are shown. No transcripts are stored or published.</p>
      </div>
    </main>
  );
}
