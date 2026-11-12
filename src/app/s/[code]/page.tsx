"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, errMsg } from "@/lib/client/api";
import { getListenAs, getPlayerId } from "@/lib/client/player";
import { createListener, speechSupported, type Listener, type MicStatus } from "@/lib/client/speech";
import { useSession } from "@/lib/client/useSession";
import { useT } from "@/lib/i18n";
import { AiBadge } from "@/components/AiBadge";
import { FineCard } from "@/components/FineCard";
import { Jar } from "@/components/Jar";
import { MicButton } from "@/components/MicButton";
import { Money } from "@/components/Money";
import { Scoreboard } from "@/components/Scoreboard";
import { owedBy } from "@/components/helpers";

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
  const t = useT();
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
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [ending, setEnding] = useState(false);
  const listener = useRef<Listener | null>(null);
  const speakerRef = useRef<string | null>(null);
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
  const speakerLang = speaker?.lang ?? "en-US";

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
        setError(errMsg(e));
      }
    },
    [code],
  );

  // Speech listener (recreated when the speaker's language changes)
  useEffect(() => {
    if (!ready) return;
    if (!speechSupported()) {
      setMic("unsupported");
      return;
    }
    const l = createListener({ lang: speakerLang, onFinal: (x) => void sendUtterance(x), onInterim: setInterim, onStatus: setMic });
    listener.current = l;
    return () => {
      l.stop();
      listener.current = null;
    };
  }, [ready, speakerLang, sendUtterance]);

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
      <main className="wrap stack center">
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
    <main className="wrap wide stack">
      <div className="row between">
        <div>
          <h1 style={{ fontSize: "1.6rem" }}>{jar.name}</h1>
          <span className="muted small">Code <span className="mono">{code}</span> · {jar.mode === "family" ? "🏡 Family" : "🍕 Party"}</span>
        </div>
        <div className="row">
          <AiBadge aiMode={session.aiMode} aiModel={session.aiModel} aiBusy={session.aiBusy} />
          <button className="btn sm" aria-pressed={muted} onClick={() => setMuted((m) => !m)}>
            {muted ? "🔇 Sound off" : "🔊 Sound on"}
          </button>
        </div>
      </div>

      <div className="grid2">
        <div className="stack">
          <div className="card">
            <Jar fines={fines} />
          </div>

          <section className="card stack" aria-label="My total">
            <div className="row between">
              <h2>{speaker.id === me.id ? "Your total" : `${speaker.name}'s total`}</h2>
              <span>
                <Money cents={owed} currency={jar.currency} big /> <span className="muted">of </span>
                <Money cents={cap} currency={jar.currency} />
              </span>
            </div>
            <div className={`progress${pct >= 100 ? " full" : ""}`} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Share of your cap used">
              <div style={{ width: `${pct}%` }} />
            </div>
            {pct >= 100 && <p className="small">Cap reached: you can’t be charged more than your hold.</p>}
          </section>

          <section className="card stack" aria-label="Microphone">
            <MicButton status={mic} onStart={() => listener.current?.start()} onStop={() => listener.current?.stop()} />
            {speaker.id !== me.id && <p className="small">Listening as <strong>{speaker.name}</strong> ({speakerLang}).</p>}
            {interim && <p className="muted" style={{ fontStyle: "italic" }}>{interim}</p>}
            <form
              className="row"
              style={{ flexWrap: "nowrap" }}
              onSubmit={(e) => {
                e.preventDefault();
                void sendUtterance(typed);
                setTyped("");
              }}
            >
              <label className="field" style={{ flex: 1 }}>
                <span className={unsupported ? "" : "sr"}>{unsupported ? "Type what you say" : "Type mode"}</span>
                <input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Type mode: write what you said…" />
              </label>
              <button className="btn" type="submit" disabled={!typed.trim()} style={{ alignSelf: "flex-end" }}>
                Send
              </button>
            </form>
            <p className="muted small">No audio is recorded or uploaded: only the finished text of what you say is sent.</p>
          </section>

          {me.isCreator && multipliers.length > 0 && (
            <section className="card stack" aria-label="Multiplier">
              <h2>Multiplier</h2>
              <div className="row">
                {multipliers.map((m) => (
                  <button
                    key={m.id}
                    className="btn sm"
                    aria-pressed={session.activeMultiplierId === m.id}
                    onClick={() => void post("multiplier", { playerId: me.id, multiplierId: session.activeMultiplierId === m.id ? null : m.id })}
                  >
                    {session.activeMultiplierId === m.id ? "✓ " : ""}{m.when} ×{m.factor}
                  </button>
                ))}
              </div>
            </section>
          )}
          <Scoreboard session={session} meId={me.id} />
        </div>

        <div className="stack">
          <h2>Fines</h2>
          {error && <p className="error" role="alert">{error}</p>}
          {feed.length === 0 ? (
            <div className="card center muted">
              <div style={{ fontSize: "2.5rem" }} aria-hidden="true">😇</div>
              No fines yet. Keep it clean!
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
        </div>
      </div>

      {me.isCreator && (
        <div className="card stack">
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
            <button className="btn danger block" onClick={() => setConfirmEnd(true)}>
              {t("End session & settle")}
            </button>
          )}
        </div>
      )}
    </main>
  );
}
