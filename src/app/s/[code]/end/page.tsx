"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api, errMsg } from "@/lib/client/api";
import { getPlayerId } from "@/lib/client/player";
import { useSession } from "@/lib/client/useSession";
import { Money } from "@/components/Money";
import { formatMoney } from "@/lib/money";
import { SandboxBadge } from "@/components/SandboxBadge";
import { owedBy, settleLabel, sponsoredOf } from "@/components/helpers";
import type { Player, PublicSession } from "@/lib/types";
import s from "./end.module.css";

function Report({ session, p }: { session: PublicSession; p: Player }) {
  const r = session.reports[p.id];
  return (
    <div className="card flat stack" style={{ marginTop: 0 }}>
      <strong>{p.name}</strong>
      {r ? (
        <>
          <h3>{r.title}</h3>
          <p>{r.summary}</p>
          {r.mostUsed && (
            <p className="small muted">
              Most used: <span className="censor">{r.mostUsed}</span>
            </p>
          )}
          {r.alternatives.length > 0 && <p className="small">Next time try: {r.alternatives.join(", ")}</p>}
        </>
      ) : (
        <p className="muted small">No report yet.</p>
      )}
    </div>
  );
}

export default function End() {
  const params = useParams<{ code: string }>();
  const code = (params.code ?? "").toUpperCase();
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { session, error: loadError, refresh } = useSession(code, playerId);

  useEffect(() => {
    setPlayerId(getPlayerId(code));
    setReady(true);
  }, [code]);

  async function retry() {
    if (!playerId) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/sessions/${code}/end`, { playerId });
      await refresh();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  if (loadError && !session) {
    return (
      <main className="wrap stack">
        <h1>Jar not found</h1>
        <Link href="/" className="btn">Home</Link>
      </main>
    );
  }
  if (!ready || !session) return <main className="wrap"><p className="muted" role="status">Loading…</p></main>;

  const { jar } = session;
  const payers = Object.values(session.players)
    .filter((p) => !p.sponsorId)
    .sort((a, b) => a.name.localeCompare(b.name));
  const settling = session.status === "settling" || session.status === "live" || session.status === "lobby";
  let totalCaptured = 0;
  const rows = payers.map((p) => {
    const res = session.settle[p.id];
    const hold = p.hold;
    const status = res?.status ?? (hold?.status === "captured" || hold?.status === "voided" || hold?.status === "settle_failed" ? hold.status : null);
    const amount = res?.amountCents ?? hold?.capturedCents ?? 0;
    if (status === "captured") totalCaptured += amount;
    return { p, res, hold, status, amount, captureId: res?.captureId ?? hold?.captureId };
  });

  return (
    <main className="wrap stack">
      <div className="row between">
        <h1>Final bill</h1>
        <SandboxBadge />
      </div>
      <p className="muted">{jar.name}. Fines go to {jar.beneficiaryName}. Nothing real was charged.</p>
      {settling && <p className="notice" role="status">Settling with PayPal. This page updates by itself.</p>}
      {error && <p className="error" role="alert">{error}</p>}

      <section className="card" aria-label="Final bill">
        {rows.map(({ p, res, hold, status, amount, captureId }) => {
          const count = session.fines.filter((f) => f.playerId === p.id && f.status !== "dropped").length;
          const owed = owedBy(p.id, session.fines, jar.capCents);
          return (
            <div key={p.id} className={s.row} aria-label={`Result for ${p.name}`}>
              <div>
                <h2>{p.name}</h2>
                <span className="muted small">
                  {count} {count === 1 ? "fine" : "fines"}, worth <Money cents={owed} currency={jar.currency} />
                </span>
              </div>
              <div className={s.right}>
                {status === "captured" && <span className={`badge hold ${s.stamp}`}>{settleLabel("captured", amount, jar.currency)}</span>}
                {status === "voided" && <span className={`badge good ${s.stamp}`}>Voided</span>}
                {status === "settle_failed" && <span className={`badge bad ${s.stamp}`}>Settle failed</span>}
                {!status && hold?.status === "on_hold" && (
                  <span className="badge hold">On hold {formatMoney(hold.amountCents, jar.currency)}</span>
                )}
                {status === "captured" && captureId && <span className="small muted">Capture ID {captureId}</span>}
                {status === "voided" && <span className="small">Clean mouth. Nothing charged.</span>}
                {status === "settle_failed" && (
                  <>
                    {res?.error && <span className="error small">{res.error}</span>}
                    <button className="btn sm" onClick={retry} disabled={busy}>
                      {busy ? "Retrying…" : "Retry"}
                    </button>
                  </>
                )}
                {!status && (!hold || hold.status === "none" || hold.status === "pending") && (
                  <span className="muted small">{hold?.status === "pending" ? "Hold never approved. Nothing to settle." : "No PayPal hold. Nothing to settle."}</span>
                )}
              </div>
            </div>
          );
        })}
        <div className={s.total}>
          <h2>Total captured</h2>
          <Money cents={totalCaptured} currency={jar.currency} big />
        </div>
      </section>

      <div className={s.reports}>
        {payers.map((p) => (
          <div key={p.id} className="stack">
            <Report session={session} p={p} />
            {sponsoredOf(session, p.id).map((sp) => (
              <div key={sp.id} className="stack">
                <Report session={session} p={sp} />
                <p className="muted small">Covered by {p.name}’s hold.</p>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="row">
        {session.receiptId && (
          <Link className="btn primary" href={`/r/${session.receiptId}`}>
            View public receipt
          </Link>
        )}
        <Link href="/" className="btn">Home</Link>
      </div>
    </main>
  );
}

