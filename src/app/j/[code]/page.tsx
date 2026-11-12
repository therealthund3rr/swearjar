"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, errMsg, useConfig } from "@/lib/client/api";
import { getListenAs, getPlayerId, saveListenAs, savePlayer } from "@/lib/client/player";
import { useSession } from "@/lib/client/useSession";
import { useT } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";
import { AiBadge } from "@/components/AiBadge";
import { Money } from "@/components/Money";
import { PayPalHoldButton } from "@/components/PayPalHoldButton";
import { SandboxBadge } from "@/components/SandboxBadge";
import { SPEECH_LANG, holdAmount, holdLabel, sponsoredOf } from "@/components/helpers";

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
        <span>Name</span>
        <input className="input" value={name} maxLength={30} onChange={(e) => setName(e.target.value)} />
      </label>
      <button className="btn primary block" type="submit" disabled={busy || !name.trim()}>
        {submitLabel}
      </button>
    </form>
  );
}

export default function Lobby() {
  const t = useT();
  const router = useRouter();
  const params = useParams<{ code: string }>();
  const code = (params.code ?? "").toUpperCase();
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [listenAs, setListenAs] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSponsor, setShowSponsor] = useState(false);
  const { config } = useConfig();
  const { session, error: loadError, refresh } = useSession(code, playerId);

  useEffect(() => {
    setPlayerId(getPlayerId(code));
    setListenAs(getListenAs(code));
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

  async function addSponsored(name: string) {
    if (!playerId) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/jars/${code}/players`, { name, lang: SPEECH_LANG, sponsorId: playerId });
      setShowSponsor(false);
      await refresh();
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

  if (loadError && !session) {
    return (
      <main className="wrap stack center">
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
  const family = jar.mode === "family";
  const me = playerId ? session.players[playerId] : undefined;
  const players = Object.values(session.players).sort((a, b) => a.joinedAt - b.joinedAt);

  const header = (
    <div className="stack">
      <div className="row between">
        <h1>{jar.name}</h1>
        <span className="badge">{family ? "🏡 Family" : "🍕 Party"}</span>
      </div>
      <div className="muted">
        Code <span className="mono"><strong>{code}</strong></span> · cap <Money cents={jar.capCents} currency={jar.currency} /> per player · money goes to {jar.beneficiaryName}
      </div>
    </div>
  );

  if (!me) {
    return (
      <main className="wrap stack">
        {header}
        {playerId && <p className="notice">This device was in the jar before but the server no longer knows you. Join again.</p>}
        <div className="card stack">
          <h2>Join this jar</h2>
          <NameForm submitLabel={t("Join")} onSubmit={join} busy={busy} />
          {error && <p className="error" role="alert">{error}</p>}
        </div>
      </main>
    );
  }

  const sponsored = sponsoredOf(session, me.id);
  const isSponsored = !!me.sponsorId;
  const myHold = me.hold?.status ?? "none";
  const holding = myHold === "on_hold";
  const amount = isSponsored ? 0 : holdAmount(session, me.id);
  const missingHolds = players.filter((p) => !p.sponsorId && p.hold?.status !== "on_hold");
  const allHeld = missingHolds.length === 0;
  const isCreator = me.isCreator;
  const speaker = sponsored.find((p) => p.id === listenAs) ? listenAs! : me.id;

  return (
    <main className="wrap stack">
      {header}
      <AiBadge aiMode={session.aiMode} aiModel={session.aiModel} aiBusy={session.aiBusy} />

      {!isSponsored && (
        <section className="card stack" aria-label="PayPal hold">
          <div className="row between">
            <h2>Your hold</h2>
            <SandboxBadge />
          </div>
          {holding ? (
            <>
              <div className="money big">🔒 <Money cents={me.hold?.amountCents ?? amount} currency={jar.currency} /> on hold</div>
              <p className="muted small">PayPal authorization hold — you only pay what you say.</p>
            </>
          ) : (
            <>
              <div>
                <div className="badge warn">No hold yet</div>
                <div style={{ marginTop: 6 }}>
                  Approve a hold of <Money cents={amount} currency={jar.currency} big /> with PayPal to play
                </div>
                {family && sponsored.length > 0 && (
                  <div className="muted small">
                    {formatMoney(jar.capCents, jar.currency)} for you + {sponsored.length} sponsored {sponsored.length === 1 ? "player" : "players"}
                  </div>
                )}
              </div>
              <p className="muted small">
                PayPal authorization hold. Nothing is charged now: at the end only your fines are captured and the rest is released.
              </p>
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
            </>
          )}
        </section>
      )}

      {family && !isSponsored && !holding && (
        <section className="card stack">
          <h2>Sponsored players</h2>
          <p className="muted small">Kids have no PayPal. Add them here: your hold covers their cap too. Add them before you approve the hold.</p>
          {showSponsor ? (
            <NameForm submitLabel="Add sponsored player" onSubmit={addSponsored} busy={busy} />
          ) : (
            <button className="btn" onClick={() => setShowSponsor(true)}>
              ＋ Add a sponsored player
            </button>
          )}
        </section>
      )}

      {sponsored.length > 0 && (
        <section className="card stack">
          <h2>Listen as</h2>
          <p className="muted small">One device per speaker. Pick who speaks on this device.</p>
          <select
            className="input"
            aria-label="Listen as"
            value={speaker}
            onChange={(e) => {
              setListenAs(e.target.value);
              saveListenAs(code, e.target.value);
            }}
          >
            <option value={me.id}>Me ({me.name})</option>
            {sponsored.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </section>
      )}

      <section className="card stack" aria-label="Players">
        <h2>{t("Players")}</h2>
        <ul style={{ listStyle: "none", padding: 0 }} className="stack">
          {players.map((p) => {
            const sponsor = p.sponsorId ? session.players[p.sponsorId] : null;
            return (
              <li key={p.id} className="row between">
                <span>
                  {sponsor && <span className="muted">↳ </span>}
                  <strong>{p.name}</strong>
                  {p.isCreator && <span className="muted small"> · creator</span>}
                  {p.id === me.id && <span className="muted"> (you)</span>}
                </span>
                {sponsor ? (
                  <span className="badge">covered by {sponsor.name}</span>
                ) : (
                  <span className={`badge ${p.hold?.status === "on_hold" ? "good" : "warn"}`}>
                    {p.hold?.status === "on_hold" ? (
                      <>🔒 On hold <Money cents={p.hold.amountCents} currency={jar.currency} /></>
                    ) : (
                      holdLabel(p.hold?.status)
                    )}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        <p className="notice">{t("Everyone in this jar can see your fines")}.</p>
        <p className="muted small">🎧 Use headphones in calls; in the same room keep your phone close to you. The mic works in Chrome or Edge.</p>
      </section>

      {error && <p className="error" role="alert">{error}</p>}
      {session.status === "live" ? (
        <p className="notice" role="status">The session is already live. Approve your hold above to join in.</p>
      ) : isCreator ? (
        <div className="stack">
          <button className="btn primary block" onClick={start} disabled={busy || !allHeld}>
            {t("Start session")}
          </button>
          {!allHeld && (
            <p className="muted small center" role="status">
              Waiting for holds: {missingHolds.map((p) => p.name).join(", ")}
            </p>
          )}
        </div>
      ) : (
        <p className="muted center" role="status">
          Waiting for {session.players[jar.creatorPlayerId]?.name ?? "the creator"} to start…
        </p>
      )}
    </main>
  );
}
