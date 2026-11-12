"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import QRCode from "qrcode";
import { api, errMsg, useConfig } from "@/lib/client/api";
import { savePlayer } from "@/lib/client/player";
import { useT } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";
import type { AiMode, Mode } from "@/lib/types";
import type { RuleSet } from "@/lib/rules";
import { SPEECH_LANG } from "@/components/helpers";
import s from "./new.module.css";

const EXAMPLES = [
  { label: "Example", text: "Mild swears 25 cents, strong swears $1, blasphemy $2, 'fudge' is free, double during overtime" },
];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function PriceBoard({ rules, currency }: { rules: RuleSet; currency: string }) {
  return (
    <div className="stack">
      <div className={s.board}>
        {rules.tiers.map((t) => (
          <div key={t.id} className={s.tier}>
            <h3 className={s.label}>{t.label}</h3>
            <span className={`money ${s.price}`}>{formatMoney(t.price_cents, currency)}</span>
            <span className={s.desc}>
              {t.description}
              {t.examples.length > 0 && <> (e.g. {t.examples.join(", ")})</>}
            </span>
          </div>
        ))}
      </div>
      {rules.free_terms.length > 0 && (
        <div className={s.chips} aria-label="Free words">
          {rules.free_terms.map((w) => (
            <span key={w} className={s.free}>{w}</span>
          ))}
        </div>
      )}
      {rules.multipliers.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {rules.multipliers.map((m, i) => (
            <li key={i} className="money" style={{ fontSize: "1.4rem" }}>×{m.factor} during {m.when}</li>
          ))}
        </ul>
      )}
      {rules.notes && <p className="muted small">{rules.notes}</p>}
    </div>
  );
}

export default function NewJar() {
  const t = useT();
  const router = useRouter();
  const { config, error: cfgError } = useConfig();
  const [name, setName] = useState("");
  const [jarName, setJarName] = useState("");
  const mode: Mode = "party";
  const [cap, setCap] = useState(10);
  const [email, setEmail] = useState("");
  const [rulesText, setRulesText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ code: string; playerId: string; rules: RuleSet; aiMode: AiMode } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const currency = config?.currency ?? "USD";
  const symbol = formatMoney(0, currency).replace(/[0-9.,\s]/g, "") || currency;
  const capOk = Number.isFinite(cap) && cap >= 1 && cap <= 50;
  const emailOk = !email.trim() || EMAIL_RE.test(email.trim());
  const formOk = name.trim() && jarName.trim() && rulesText.trim() && capOk && emailOk;

  async function compile() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ code: string; playerId: string; rules: RuleSet; aiMode: AiMode }>("/api/jars", {
        name: jarName.trim(),
        mode,
        capCents: Math.round(cap * 100),
        rulesText: rulesText.trim(),
        creatorName: name.trim(),
        creatorLang: SPEECH_LANG,
        ...(email.trim() ? { beneficiaryEmail: email.trim() } : {}),
      });
      savePlayer(r.code, r.playerId);
      setCreated(r);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function recompile() {
    if (!created) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ rules: RuleSet }>(`/api/jars/${created.code}/rules`, {
        playerId: created.playerId,
        action: "recompile",
        rulesText: rulesText.trim(),
      });
      setCreated({ ...created, rules: r.rules });
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function confirmRules() {
    if (!created) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/jars/${created.code}/rules`, { playerId: created.playerId, action: "confirm" });
      const url = `${window.location.origin}/j/${created.code}`;
      try {
        setQr(await QRCode.toDataURL(url, { margin: 1, width: 280 }));
      } catch {}
      setConfirmed(true);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/j/${created.code}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy. Share the code instead.");
    }
  }

  if (created && confirmed) {
    return (
      <main className="wrap stack">
        <h1>Your jar is ready</h1>
        <div className="card">
          <div className={s.ready}>
            <div className="stack">
              <p className="muted">Friends open the app and type this code.</p>
              <div className="code-big" aria-label={`Join code ${created.code.split("").join(" ")}`}>{created.code}</div>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {qr && <div className={s.qr}><img src={qr} alt={`QR code to join jar ${created.code}`} /></div>}
          </div>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="row">
          <button className="btn" onClick={copyLink}>{copied ? "Copied" : "Copy invite link"}</button>
          <button className="btn primary" onClick={() => router.push(`/j/${created.code}`)}>
            {t("Continue to lobby")}
          </button>
        </div>
      </main>
    );
  }

  if (created) {
    return (
      <main className="wrap stack">
        <h1>Check the prices</h1>
        <p className="muted">
          {created.aiMode === "lexicon" ? "No AI available, so this comes from the built-in word list. " : ""}
          Your sentence, turned into a price list. Code, not AI, charges these prices.
        </p>
        <div className="card">
          <PriceBoard rules={created.rules} currency={currency} />
        </div>
        <label className="field">
          <span>{t("House rules")}</span>
          <textarea className="input" value={rulesText} onChange={(e) => setRulesText(e.target.value)} />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="row">
          <button className="btn primary" onClick={confirmRules} disabled={busy}>
            {t("Looks right")}
          </button>
          <button className="btn" onClick={recompile} disabled={busy || !rulesText.trim()}>
            {t("Recompile")}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="wrap stack">
      <Link href="/">Home</Link>
      <h1>{t("Create a jar")}</h1>
      <div className="card stack">
        <label className="field">
          <span>{t("Your name")}</span>
          <input className="input" value={name} maxLength={30} onChange={(e) => setName(e.target.value)} autoComplete="given-name" />
        </label>
        <label className="field">
          <span>{t("Jar name")}</span>
          <input className="input" value={jarName} maxLength={40} placeholder="FIFA night" onChange={(e) => setJarName(e.target.value)} />
        </label>
        <label className="field">
          <span>{t("Cap per player")} ({symbol}, 1 to 50)</span>
          <input className="input" type="number" min={1} max={50} step={1} value={cap} onChange={(e) => setCap(Number(e.target.value))} />
          <span className="muted small" style={{ fontWeight: 400 }}>
            The most anyone can ever pay: {capOk ? formatMoney(Math.round(cap * 100), currency) : "n/a"}
          </span>
        </label>
        <label className="field">
          <span>{t("House rules")}</span>
          <textarea className="input" value={rulesText} onChange={(e) => setRulesText(e.target.value)} placeholder="Write the prices in plain English." />
        </label>
        <div className="stack" style={{ marginTop: 0 }}>
          {EXAMPLES.map((ex) => (
            <button key={ex.label} type="button" className="chip" onClick={() => setRulesText(ex.text)}>
              {ex.text}
            </button>
          ))}
        </div>
        <label className="field">
          <span>PayPal sandbox email that receives the fines</span>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="group-fund@example.com"
            aria-invalid={!emailOk}
          />
          <span className={emailOk ? "muted small" : "error small"} style={{ fontWeight: 400 }}>
            {emailOk ? "Leave it empty to use the demo fund." : "That does not look like an email."}
          </span>
        </label>
        {cfgError && <p className="error">Cannot load config: {cfgError}</p>}
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn primary block" onClick={compile} disabled={busy || !formOk}>
          {busy ? "Compiling…" : t("Compile rules")}
        </button>
      </div>
    </main>
  );
}
