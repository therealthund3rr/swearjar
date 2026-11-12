"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api, errMsg } from "@/lib/client/api";
import { getPlayerId } from "@/lib/client/player";
import { useSession } from "@/lib/client/useSession";
import { Money } from "@/components/Money";
import { SandboxBadge } from "@/components/SandboxBadge";
import { owedBy, sponsoredOf } from "@/components/helpers";
import type { Player, PublicSession } from "@/lib/types";

function Report({ session, p }: { session: PublicSession; p: Player }) {
  const r = session.reports[p.id];
  const count = session.fines.filter((f) => f.playerId === p.id && f.status !== "dropped").length;
  const owed = owedBy(p.id, session.fines, session.jar.capCents);
  return (
    <div className="stack" style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}>
      <div className="row between">
        <strong>{p.name}</strong>
        <span className="muted small">
          {count} {count === 1 ? "fine" : "fines"} · <Money cents={owed} currency={session.jar.currency} />
        </span>
      </div>
      {r ? (
        <>
          <div>
            <span className="badge">🏅 {r.title}</span>
          </div>
          <p>{r.summary}</p>
          {r.mostUsed && <p className="small muted">Most used: <span className="mono">{r.mostUsed}</span></p>}
          {r.alternatives.length > 0 && <p className="small">💡 Try instead: {r.alternatives.join(", ")}</p>}
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
      <main className="wrap stack center">
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

  return (
    <main className="wrap stack">
      <div className="row between">
        <h1>{jar.name}: final bill</h1>
        <SandboxBadge />
      </div>
      <p className="muted">Money goes to {jar.beneficiaryName}. Sandbox only, nothing real was charged.</p>
      {settling && <p className="notice" role="status">Settling with PayPal… this page updates by itself.</p>}
      {error && <p className="error" role="alert">{error}</p>}

      {payers.map((p) => {
        const res = session.settle[p.id];
        const hold = p.hold;
        const sponsored = sponsoredOf(session, p.id);
        const status = res?.status ?? (hold?.status === "captured" || hold?.status === "voided" || hold?.status === "settle_failed" ? hold.status : null);
        const amount = res?.amountCents ?? hold?.capturedCents ?? 0;
        const captureId = res?.captureId ?? hold?.captureId;
        const noHold = !hold || hold.status === "none" || hold.status === "pending";
        return (
          <section key={p.id} className="card stack" aria-label={`Result for ${p.name}`}>
            <div className="row between">
              <h2>{p.name}</h2>
              {status === "captured" && <span className="badge good">Captured</span>}
              {status === "voided" && <span className="badge good">Voided</span>}
              {status === "settle_failed" && <span className="badge bad">Settle failed</span>}
              {!status && hold?.status === "on_hold" && <span className="badge warn">On hold</span>}
            </div>
            {status === "captured" && (
              <>
                <div className="money big">Captured <Money cents={amount} currency={jar.currency} /></div>
                {captureId && <div className="small">Capture ID: <span className="mono">{captureId}</span></div>}
              </>
            )}
            {status === "voided" && <div className="money" style={{ fontSize: "1.4rem" }}>Voided — clean mouth! 😇</div>}
            {status === "settle_failed" && (
              <div className="stack">
                <p className="error">Settle failed{res?.error ? `: ${res.error}` : ""}</p>
                <div>
                  <button className="btn" onClick={retry} disabled={busy}>
                    {busy ? "Retrying…" : "Retry"}
                  </button>
                </div>
              </div>
            )}
            {!status && hold?.status === "on_hold" && (
              <div className="muted">
                On hold: <Money cents={hold.amountCents} currency={jar.currency} />
              </div>
            )}
            {noHold && !status && <div className="muted">No PayPal hold: nothing to settle.</div>}
            <Report session={session} p={p} />
            {sponsored.map((s) => (
              <div key={s.id} style={{ marginLeft: 12 }}>
                <Report session={session} p={s} />
                <p className="muted small">Covered by {p.name}’s hold.</p>
              </div>
            ))}
          </section>
        );
      })}

      {session.receiptId && (
        <Link className="btn primary block" href={`/r/${session.receiptId}`}>
          View public receipt
        </Link>
      )}
      <Link href="/" className="center">Home</Link>
    </main>
  );
}
