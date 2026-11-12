"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, errMsg, useConfig } from "@/lib/client/api";
import { getPlayerId, savePlayer } from "@/lib/client/player";
import { useSession } from "@/lib/client/useSession";
import { AiBadge } from "@/components/AiBadge";
import { Money } from "@/components/Money";
import { PayPalHoldButton } from "@/components/PayPalHoldButton";
import { SandboxBadge } from "@/components/SandboxBadge";
import { SPEECH_LANG, holdAmount, holdLabel } from "@/components/helpers";
import css from "./lobby.module.css";

function NameForm({ submitLabel, onSubmit, busy }: { submitLabel: string; onSubmit: (name: string) => void; busy: boolean }) {
  const [name, setName] = useState("");
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) onSubmit(name.trim());
      }}
    >
      <label className="field">
        <span>Your name</span>
        <input className="input" value={name} maxLength={30} onChange={(e) => setName(e.target.value)} />
      </label>
      <button className="btn primary block" type="submit" disabled={busy || !name.trim()}>
        {submitLabel}
      </button>
    </form>
  );
}

export default function Lobby() {
  const router = useRouter();
  const params = useParams<{ code: string }>();
  const code = (params.code ?? "").toUpperCase();
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { config } = useConfig();
  const { session, error: loadError, refresh } = useSession(code, playerId);

  useEffect(() => {
    setPlayerId(getPlayerId(code));
    setReady(true);
  }, [code]);

  useEffect(() => {
    if (!session) return;
    const meNow = playerId ? session.players[playerId] : undefined;
    if (session.status === "live") {
      // A late joiner must approve their hold here first.
      if (meNow && (meNow.sponsorId || meNow.hold?.status === "on_hold")) router.replace(`/s/${code}`);
    } else if (session.status === "settling" || session.status === "ended") router.replace(`/s/${code}/end`);
  }, [session, playerId, code, router]);

  async function join(name: string) {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ playerId: string }>(`/api/jars/${code}/players`, { name, lang: SPEECH_LANG });
      savePlayer(code, r.playerId);
      setPlayerId(r.playerId);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function start() {
    if (!playerId) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/sessions/${code}/start`, { playerId });
      await refresh();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/j/${code}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy. Share the code instead.");
    }
  }

  if (loadError && !session) {
    return (
      <main className="wrap stack">
        <h1>{loadError === "Jar not found" ? "Jar not found" : "Cannot load the jar"}</h1>
        <p className="muted">Code {code}. {loadError === "Jar not found" ? "Check the code and try again." : loadError}</p>
        <Link href="/" className="btn">
          Home
        </Link>
      </main>
    );
  }
  if (!ready || !session) return <main className="wrap"><p className="muted" role="status">Loading…</p></main>;

  const { jar } = session;
  const me = playerId ? session.players[playerId] : undefined;
  const players = Object.values(session.players).sort((a, b) => a.joinedAt - b.joinedAt);

  const header = (
    <header className={css.head}>
      <h1>{jar.name}</h1>
      <div className="row">
        <AiBadge aiMode={session.aiMode} aiModel={session.aiModel} aiBusy={session.aiBusy} />
        <SandboxBadge />
      </div>
      <p className="muted">
        Cap <Money cents={jar.capCents} currency={jar.currency} /> per player. Money goes to {jar.beneficiaryName}.
      </p>
    </header>
  );

  const invite = (
    <section className={`card ${css.invite}`} aria-label="Invite friends">
      <div>
        <div className="small muted">Join code</div>
        <div className={css.code}>{code}</div>
      </div>
      <button className="btn" onClick={() => void copyInvite()}>
        {copied ? "Copied" : "Copy invite link"}
      </button>
    </section>
  );

  if (!me) {
    return (
      <main className="wrap stack">
        {header}
        {playerId && <p className="notice">This device was in the jar before but the server no longer knows you. Join again.</p>}
        <div className="card stack">
          <h2>Join this jar</h2>
          <NameForm submitLabel="Join" onSubmit={join} busy={busy} />
          {error && <p className="error" role="alert">{error}</p>}
        </div>
        <p className="muted small">Everyone in this jar can see your fines.</p>
      </main>
    );
  }

  const isSponsored = !!me.sponsorId;
  const holding = me.hold?.status === "on_hold";
  const pending = me.hold?.status === "pending";
  const amount = isSponsored ? 0 : holdAmount(session, me.id);
  const missingHolds = players.filter((p) => !p.sponsorId && p.hold?.status !== "on_hold");
  const allHeld = missingHolds.length === 0;
  const isCreator = me.isCreator;
  const solo = players.length === 1;

  return (
    <main className="wrap stack">
      {header}

      {!isSponsored && (
        <section className={`card ${css.hold}`} aria-label="PayPal hold">
          {holding ? (
            <div className={css.stampWrap}>
              <div className={css.stamp}>
                <Money cents={me.hold?.amountCents ?? amount} currency={jar.currency} /> on hold
              </div>
              <p className="muted">PayPal authorization hold. You only pay what you say.</p>
            </div>
          ) : (
            <div className="stack">
              <h2 className={css.bigHead}>Put your money where your mouth is</h2>
              <p>
                Approve a <Money cents={amount} currency={jar.currency} /> PayPal hold to play. Nothing is charged now.
              </p>
              {pending && <p className="muted small">Waiting for PayPal to confirm.</p>}
              <div className={css.tile}>
                {config ? (
                  <PayPalHoldButton
                    key={amount}
                    clientId={config.paypalClientId}
                    currency={config.currency}
                    code={code}
                    playerId={me.id}
                    onApproved={() => void refresh()}
                  />
                ) : (
                  <p className="muted">Loading PayPal…</p>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {invite}

      <section className="card" aria-label="Players">
        <h2>Players</h2>
        <ul className={css.players}>
          {players.map((p) => {
            const sponsor = p.sponsorId ? session.players[p.sponsorId] : null;
            return (
              <li key={p.id} className={css.player}>
                <span className={css.pname}>
                  {p.name}
                  {p.id === me.id && <span className="muted small"> you</span>}
                  {p.isCreator && <span className="muted small"> creator</span>}
                </span>
                {sponsor ? (
                  <span className="badge">Covered by {sponsor.name}</span>
                ) : p.hold?.status === "on_hold" ? (
                  <span className="badge hold">
                    On hold <Money cents={p.hold.amountCents} currency={jar.currency} />
                  </span>
                ) : (
                  <span className="badge warn">{holdLabel(p.hold?.status)}</span>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {error && <p className="error" role="alert">{error}</p>}
      {session.status === "live" ? (
        <p className="notice" role="status">The session is already live. Approve your hold above to join in.</p>
      ) : isCreator ? (
        <div className="stack">
          <button className="btn primary block" onClick={start} disabled={busy || !allHeld}>
            {solo ? "Start a solo test run" : "Start session"}
          </button>
          {!allHeld && (
            <p className="muted small" role="status">
              Waiting for holds: {missingHolds.map((p) => p.name).join(", ")}
            </p>
          )}
        </div>
      ) : (
        <p className="muted" role="status">
          Waiting for {session.players[jar.creatorPlayerId]?.name ?? "the creator"} to start…
        </p>
      )}

      <p className="muted small">Everyone in this jar can see your fines. Use headphones on calls; in the same room keep your phone close. The mic works in Chrome or Edge.</p>
    </main>
  );
}
