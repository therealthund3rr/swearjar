"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, errMsg } from "@/lib/client/api";
import { getListenAs, getPlayerId } from "@/lib/client/player";
import { createListener, speechSupported, type Listener, type MicStatus } from "@/lib/client/speech";
import { useSession } from "@/lib/client/useSession";
import { AiBadge } from "@/components/AiBadge";
import { FineCard } from "@/components/FineCard";
import { Jar } from "@/components/Jar";
import { MicButton } from "@/components/MicButton";
import { Money } from "@/components/Money";
import { SandboxBadge } from "@/components/SandboxBadge";
import { Scoreboard } from "@/components/Scoreboard";
import css from "./live.module.css";
import { SPEECH_LANG, owedBy } from "@/components/helpers";

function blip() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.26);
    setTimeout(() => void ctx.close(), 500);
  } catch {}
}

export default function Live() {
  const router = useRouter();
  const params = useParams<{ code: string }>();
  const code = (params.code ?? "").toUpperCase();
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [listenAs, setListenAs] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const { session, error: loadError, serverNow } = useSession(code, playerId);

  const [mic, setMic] = useState<MicStatus>("off");
  const [interim, setInterim] = useState("");
  const [typed, setTyped] = useState("");
  const [muted, setMuted] = useState(false);
  const [demo, setDemo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [holdBlocked, setHoldBlocked] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [ending, setEnding] = useState(false);
  const listener = useRef<Listener | null>(null);
  const speakerRef = useRef<string | null>(null);
  const autoStarted = useRef(false);
  const holdBlockedRef = useRef(false);
  const prevCoins = useRef<number | null>(null);
  const mutedRef = useRef(false);
  mutedRef.current = muted;

  useEffect(() => {
    setPlayerId(getPlayerId(code));
    setListenAs(getListenAs(code));
    setDemo(new URLSearchParams(window.location.search).get("demo") === "1");
    setReady(true);
  }, [code]);

  const me = session && playerId ? session.players[playerId] : undefined;
  const speaker = session && listenAs && session.players[listenAs]?.sponsorId === playerId ? session.players[listenAs] : me;
  speakerRef.current = speaker?.id ?? null;

  // Redirects by status
  useEffect(() => {
    if (!ready) return;
    if (!playerId) return void router.replace(`/j/${code}`);
    if (!session) return;
    if (session.status === "lobby") router.replace(`/j/${code}`);
    else if (session.status === "settling" || session.status === "ended") router.replace(`/s/${code}/end`);
  }, [ready, playerId, session, code, router]);

  const sendUtterance = useCallback(
    async (text: string) => {
      const id = speakerRef.current;
      if (!id || !text.trim()) return;
      try {
        await api(`/api/sessions/${code}/utterances`, { playerId: id, text: text.trim(), ts: Date.now() });
      } catch (e) {
        const msg = errMsg(e);
        if (/approve your paypal hold/i.test(msg)) {
          // Show this once, stop the mic so it does not repeat on every speech result.
          if (!holdBlockedRef.current) {
            holdBlockedRef.current = true;
            setHoldBlocked(true);
            listener.current?.stop();
          }
          return;
        }
        setError(msg);
      }
    },
    [code],
  );

  // Speech listener (English only)
  useEffect(() => {
    if (!ready) return;
    if (!speechSupported()) {
      setMic("unsupported");
      return;
    }
    const l = createListener({ lang: SPEECH_LANG, onFinal: (x) => void sendUtterance(x), onInterim: setInterim, onStatus: setMic });
    listener.current = l;
    return () => {
      l.stop();
      listener.current = null;
    };
  }, [ready, sendUtterance]);

  // Auto-start the mic once the session is live (if the browser allows it without a tap)
  const sessionLive = session?.status === "live";
  useEffect(() => {
    if (!ready || !sessionLive || autoStarted.current || holdBlockedRef.current) return;
    if (!listener.current || !speechSupported()) return;
    autoStarted.current = true;
    listener.current.start();
  }, [ready, sessionLive, mic]);

  // Demo script
  const live = session?.status === "live";
  useEffect(() => {
    if (!demo || !live) return;
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    void import("@/lib/demo-script").then(({ DEMO_SCRIPT }) => {
      if (cancelled) return;
      let at = 0;
      for (const line of DEMO_SCRIPT) {
        at += line.delayMs;
        timers.push(setTimeout(() => void sendUtterance(line.text), at));
      }
    });
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [demo, live, sendUtterance]);

  // Coin sound on new fines
  const coinCount = session ? session.fines.filter((f) => f.status !== "dropped").length : null;
  useEffect(() => {
    if (coinCount === null) return;
    if (prevCoins.current !== null && coinCount > prevCoins.current && !mutedRef.current) blip();
    prevCoins.current = coinCount;
  }, [coinCount]);

  async function post(path: string, body: unknown) {
    setError(null);
    try {
      await api(`/api/sessions/${code}/${path}`, body);
    } catch (e) {
      setError(errMsg(e));
    }
  }

  async function endSession() {
    if (!playerId) return;
    setEnding(true);
    setError(null);
    listener.current?.stop();
    try {
      await api(`/api/sessions/${code}/end`, { playerId });
      router.push(`/s/${code}/end`);
    } catch (e) {
      setError(errMsg(e));
      setEnding(false);
    }
  }

  if (loadError && !session) {
    return (
      <main className="wrap stack">
        <h1>Jar not found</h1>
        <p className="muted">{loadError}</p>
        <Link href="/" className="btn">Home</Link>
      </main>
    );
  }
  if (!ready || !session || !me || !speaker) return <main className="wrap"><p className="muted" role="status">Loading…</p></main>;

  const { jar, fines } = session;
  const cap = jar.capCents;
  const owed = owedBy(speaker.id, fines, cap);
  const pct = Math.min(100, Math.round((owed / cap) * 100));
  const feed = [...fines].sort((a, b) => b.ts - a.ts);
  const unsupported = mic === "unsupported";
  const multipliers = jar.rules.multipliers;

  return (
    <main className={`wrap wide ${css.page}`}>
      <header className={css.head}>
        <div>
          <h1 className={css.title}>{jar.name}</h1>
          <span className="muted small">Code {code}</span>
        </div>
        <div className="row">
          <AiBadge aiMode={session.aiMode} aiModel={session.aiModel} aiBusy={session.aiBusy} />
          <SandboxBadge />
          <button className="btn sm" aria-pressed={muted} onClick={() => setMuted((m) => !m)}>
            {muted ? "Sound off" : "Sound on"}
          </button>
        </div>
      </header>

      <div className={css.cols}>
        <div className={css.left}>
          <div className={css.jarWrap}>
            <Jar fines={fines} />
          </div>

          <section className="card" aria-label="My total">
            <div className="small muted">{speaker.id === me.id ? "Your total" : `${speaker.name}'s total`}</div>
            <div className={css.totalRow}>
              <Money cents={owed} currency={jar.currency} big />
              <span className="muted">of <Money cents={cap} currency={jar.currency} /></span>
            </div>
            <div className={`progress${pct >= 100 ? " full" : ""}`} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Share of your cap used">
              <div style={{ width: `${pct}%` }} />
            </div>
            {pct >= 100 && <p className="small" style={{ marginTop: 8 }}>Cap reached: you can’t be charged more than your hold.</p>}
          </section>

          <section className={css.mic} aria-label="Microphone">
            {holdBlocked && (
              <div className="notice" role="alert">
                Approve your PayPal hold first. The mic is off.{" "}
                <Link href={`/j/${code}`}><strong>Back to the lobby to approve your hold</strong></Link>
              </div>
            )}
            <MicButton status={mic} onStart={() => listener.current?.start()} onStop={() => listener.current?.stop()} />
            {speaker.id !== me.id && <p className="small">Listening as <strong>{speaker.name}</strong> (English).</p>}
            {interim && <p className={css.caption}>hearing: {interim}</p>}
            <form
              className={css.typeForm}
              onSubmit={(e) => {
                e.preventDefault();
                void sendUtterance(typed);
                setTyped("");
              }}
            >
              <label className="field" style={{ flex: 1 }}>
                <span className={unsupported ? "" : "small muted"}>Or type what you said</span>
                <input className={`input ${css.small}`} value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Say it here" />
              </label>
              <button className="btn sm" type="submit" disabled={!typed.trim()}>
                Send
              </button>
            </form>
          </section>
        </div>

        <div className={css.right}>
          <h2>Fines</h2>
          {error && <p className="error" role="alert">{error}</p>}
          {feed.length === 0 ? (
            <div className="card">
              <h3>Clean so far</h3>
              <p className="muted">No fines yet. Keep it that way.</p>
            </div>
          ) : (
            feed.map((f) => (
              <FineCard
                key={f.id}
                fine={f}
                session={session}
                meId={me.id}
                serverNow={serverNow}
                onObject={(fineId) => void post("objections", { playerId: me.id, fineId, action: "object" })}
                onVote={(fineId, vote) => void post("objections", { playerId: me.id, fineId, action: "vote", vote })}
              />
            ))
          )}
          <Scoreboard session={session} meId={me.id} />
        </div>
      </div>

      {me.isCreator && (
        <footer className={`card flat ${css.foot}`}>
          {multipliers.length > 0 && (
            <div className="stack">
              <strong>Multiplier</strong>
              <div className="row">
                {multipliers.map((m) => (
                  <button
                    key={m.id}
                    className={`btn sm ${session.activeMultiplierId === m.id ? css.on : ""}`}
                    aria-pressed={session.activeMultiplierId === m.id}
                    onClick={() => void post("multiplier", { playerId: me.id, multiplierId: session.activeMultiplierId === m.id ? null : m.id })}
                  >
                    {m.when} x{m.factor}
                  </button>
                ))}
              </div>
            </div>
          )}
          {confirmEnd ? (
            <div role="alertdialog" aria-label="Confirm end of session" className="stack">
              <strong>End the session now?</strong>
              <p className="muted small">PayPal will capture what each player owes and void the rest. This can’t be undone.</p>
              <div className="row">
                <button className="btn danger" onClick={endSession} disabled={ending}>
                  {ending ? "Settling…" : "Yes, end and settle"}
                </button>
                <button className="btn" onClick={() => setConfirmEnd(false)} disabled={ending}>
                  Keep playing
                </button>
              </div>
            </div>
          ) : (
            <div>
              <button className="btn danger" onClick={() => setConfirmEnd(true)}>
                End session and settle
              </button>
            </div>
          )}
        </footer>
      )}
    </main>
  );
}
