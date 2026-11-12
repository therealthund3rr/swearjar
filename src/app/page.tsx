"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useT } from "@/lib/i18n";

export default function Home() {
  const t = useT();
  const router = useRouter();
  const [code, setCode] = useState("");
  const steps = [
    { icon: "🔒", title: t("Hold"), text: "Everyone approves a PayPal authorization hold, for example $10. Nothing is charged yet." },
    { icon: "🎙", title: t("Talk"), text: "Each phone listens to its own owner. An AI judge reads the words in context and applies your house rules." },
    { icon: "🧾", title: t("Settle"), text: "PayPal captures only what each person said. Clean mouths get their hold voided." },
  ];
  return (
    <main className="wrap stack">
      <div className="center stack" style={{ paddingTop: 24 }}>
        <div style={{ fontSize: "4rem" }} aria-hidden="true">🫙</div>
        <h1>{t("A swear jar that listens. Pay only for what you said.")}</h1>
        <p className="muted">Game night with friends: put money on the line, talk, and settle the bill with PayPal.</p>
      </div>
      <div className="stack">
        <Link href="/new" className="btn primary block">
          {t("Create a jar")}
        </Link>
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.length === 6) router.push(`/j/${code}`);
          }}
        >
          <label className="field" style={{ flex: 1, minWidth: 160 }}>
            <span className="sr">Jar code</span>
            <input
              className="input mono"
              placeholder="ABC123"
              maxLength={6}
              autoCapitalize="characters"
              autoComplete="off"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
              style={{ letterSpacing: "0.25em", textAlign: "center", fontSize: "1.3rem" }}
            />
          </label>
          <button className="btn" type="submit" disabled={code.length !== 6}>
            {t("Join with code")}
          </button>
        </form>
      </div>
      <ol className="stack" style={{ listStyle: "none", padding: 0 }}>
        {steps.map((s, i) => (
          <li key={s.title} className="card row" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
            <span style={{ fontSize: "2rem" }} aria-hidden="true">{s.icon}</span>
            <div>
              <h2>
                {i + 1}. {s.title}
              </h2>
              <p className="muted">{s.text}</p>
            </div>
          </li>
        ))}
      </ol>
      <footer className="center muted small">{t("Sandbox only. No real money.")}</footer>
    </main>
  );
}
