"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { api, errMsg, useConfig } from "@/lib/client/api";
import { savePlayer } from "@/lib/client/player";
import { useT } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";
import type { AiMode, Mode } from "@/lib/types";
import type { RuleSet } from "@/lib/rules";
import { LANGS, defaultLang } from "@/components/helpers";

const EXAMPLES = [
  { label: "IT", text: "Bestemmie 2€, parolacce 50 cent, 'cavolo' è gratis, doppio durante i rigori" },
  { label: "EN", text: "Mild swears 25 cents, strong 1 dollar, 'fudge' is free, double during overtime" },
];

function RulesTable({ rules, currency }: { rules: RuleSet; currency: string }) {
  return (
    <div className="stack">
      <table className="rules">
        <thead>
          <tr>
            <th>Tier</th>
            <th>Price</th>
            <th>What counts</th>
          </tr>
        </thead>
        <tbody>
          {rules.tiers.map((t) => (
            <tr key={t.id}>
              <td>
                <strong>{t.label}</strong>
              </td>
              <td className="money">{formatMoney(t.price_cents, currency)}</td>
              <td>
                {t.description}
                {t.examples.length > 0 && <div className="muted small">e.g. {t.examples.join(", ")}</div>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        <strong>Free words:</strong> {rules.free_terms.length ? rules.free_terms.join(", ") : "none"}
      </p>
      <p>
        <strong>Multipliers:</strong>{" "}
        {rules.multipliers.length ? rules.multipliers.map((m) => `${m.when} ×${m.factor}`).join("; ") : "none"}
      </p>
      {rules.notes && <p className="muted small">{rules.notes}</p>}
    </div>
  );
}

export default function NewJar() {
  const t = useT();
  const router = useRouter();
  const { config, error: cfgError } = useConfig();
  const [name, setName] = useState("");
  const [lang, setLang] = useState("en-US");
  const [jarName, setJarName] = useState("");
  const [mode, setMode] = useState<Mode>("party");
  const [cap, setCap] = useState(10);
  const [email, setEmail] = useState("");
  const [rulesText, setRulesText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ code: string; playerId: string; rules: RuleSet; aiMode: AiMode } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => setLang(defaultLang()), []);

  const currency = config?.currency ?? "USD";
  const capOk = Number.isFinite(cap) && cap >= 1 && cap <= 50;
  const formOk = name.trim() && jarName.trim() && rulesText.trim() && capOk;

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
        creatorLang: lang,
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

  if (created && confirmed) {
    return (
      <main className="wrap stack center">
        <h1>Your jar is ready 🫙</h1>
        <p className="muted">Share this code. Friends open the app and join.</p>
        <div className="card">
          <div className="code-big" aria-label={`Join code ${created.code.split("").join(" ")}`}>{created.code}</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {qr && <img src={qr} alt={`QR code to join jar ${created.code}`} width={220} height={220} style={{ margin: "12px auto 0", background: "#fff", borderRadius: 12 }} />}
        </div>
        <button className="btn primary block" onClick={() => router.push(`/j/${created.code}`)}>
          {t("Continue to lobby")}
        </button>
      </main>
    );
  }

  if (created) {
    return (
      <main className="wrap stack">
        <h1>Check the rules</h1>
        <p className="muted">
          The AI turned your sentence into a price list{created.aiMode === "lexicon" ? " (no AI available: using the built-in word list)" : ""}. Code, not AI,
          charges the prices below.
        </p>
        <div className="card">
          <RulesTable rules={created.rules} currency={currency} />
        </div>
        <label className="field">
          <span>{t("House rules")}</span>
          <textarea className="input" value={rulesText} onChange={(e) => setRulesText(e.target.value)} />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="row">
          <button className="btn" onClick={recompile} disabled={busy || !rulesText.trim()}>
            {t("Recompile")}
          </button>
          <button className="btn primary" onClick={confirmRules} disabled={busy}>
            {t("Looks right")}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="wrap stack">
      <Link href="/">← Home</Link>
      <h1>{t("Create a jar")}</h1>
      <label className="field">
        <span>{t("Your name")}</span>
        <input className="input" value={name} maxLength={30} onChange={(e) => setName(e.target.value)} autoComplete="given-name" />
      </label>
      <label className="field">
        <span>{t("Language")} (microphone)</span>
        <select className="input" value={lang} onChange={(e) => setLang(e.target.value)}>
          {LANGS.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>{t("Jar name")}</span>
        <input className="input" value={jarName} maxLength={40} placeholder="FIFA night" onChange={(e) => setJarName(e.target.value)} />
      </label>
      <div className="field">
        <span style={{ fontWeight: 600, fontSize: "0.9rem", display: "block", marginBottom: 4 }}>Mode</span>
        <div className="seg" role="group" aria-label="Mode">
          <button type="button" className="btn" aria-pressed={mode === "party"} onClick={() => setMode("party")}>
            🍕 Party
          </button>
          <button type="button" className="btn" aria-pressed={mode === "family"} onClick={() => setMode("family")}>
            🏡 Family
          </button>
        </div>
        <p className="muted small" style={{ marginTop: 6 }}>
          {mode === "party"
            ? "Chi sporca paga: everyone pays only their own fines into the group fund."
            : "A parent pays and adds sponsored players (no PayPal needed). Kind tone, cleaner alternatives, no ranking. The jar and mic are always visible: it never listens in secret."}
        </p>
      </div>
      <label className="field">
        <span>
          {t("Cap per player")} ({currency}, 1–50)
        </span>
        <input className="input" type="number" min={1} max={50} step={1} value={cap} onChange={(e) => setCap(Number(e.target.value))} />
        <span className="muted small" style={{ fontWeight: 400 }}>
          The most anyone can ever pay: {capOk ? formatMoney(Math.round(cap * 100), currency) : "—"}
        </span>
      </label>
      <div className="card stack">
        <div>
          <strong>Currency:</strong> {currency} <span className="muted small">(set by the server)</span>
        </div>
        <div>
          <strong>Beneficiary:</strong> {config?.beneficiaryName ?? "…"}
        </div>
        <label className="field">
          <span>Sandbox PayPal email to receive the money (optional)</span>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="group-fund@example.com" />
        </label>
        {cfgError && <p className="error">Cannot load config: {cfgError}</p>}
      </div>
      <label className="field">
        <span>{t("House rules")}</span>
        <textarea className="input" value={rulesText} onChange={(e) => setRulesText(e.target.value)} placeholder="Write the prices in plain language, any language." />
      </label>
      <div className="stack" style={{ marginTop: 0 }}>
        <span className="muted small">Examples (tap to use):</span>
        {EXAMPLES.map((ex) => (
          <button key={ex.label} type="button" className="chip" onClick={() => setRulesText(ex.text)}>
            <strong>{ex.label}</strong> · {ex.text}
          </button>
        ))}
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn primary block" onClick={compile} disabled={busy || !formOk}>
        {busy ? "Compiling…" : t("Compile rules")}
      </button>
    </main>
  );
}
