"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import s from "./home.module.css";

export default function Home() {
  const router = useRouter();
  const [code, setCode] = useState("");
  return (
    <main className="wrap wide stack">
      <div className={s.hero}>
        <div className="stack">
          <h1 className={s.h1}>A swear jar that listens.</h1>
          <p className={s.sub}>Pay only for what you said.</p>
          <div className={s.actions}>
            <Link href="/new" className="btn primary block">Create a jar</Link>
            <form
              className={s.join}
              onSubmit={(e) => {
                e.preventDefault();
                if (code.length === 6) router.push(`/j/${code}`);
              }}
            >
              <label className="field" style={{ flex: 1 }}>
                <span className="sr">Jar code</span>
                <input
                  className="input"
                  placeholder="ABC123"
                  maxLength={6}
                  autoCapitalize="characters"
                  autoComplete="off"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                  style={{ letterSpacing: "0.25em", fontSize: "1.2rem", fontWeight: 800 }}
                />
              </label>
              <button className="btn" type="submit" disabled={code.length !== 6}>Join with code</button>
            </form>
          </div>
        </div>
        <div className={s.demo} aria-hidden="true">
          <div className={s.speech}>
            Oh <span className={`censor ${s.bar}`}>****</span> I lost again!
          </div>
          <div className={s.coin} />
          <div className={`money ${s.plus}`}>+$1.00</div>
          <svg className={s.jar} viewBox="0 0 170 190" fill="none" stroke="#17120a" strokeWidth="5" strokeLinejoin="round">
            <rect x="30" y="4" width="110" height="26" rx="8" fill="#fffaf0" />
            <path d="M40 30 C10 50 10 70 10 90 V160 Q10 186 36 186 H134 Q160 186 160 160 V90 C160 70 160 50 130 30 Z" fill="#fffaf0" />
            <path d="M12 130 H158 V160 Q158 184 134 184 H36 Q12 184 12 160 Z" fill="#ffc400" stroke="none" opacity="0.7" />
          </svg>
        </div>
      </div>
      <ol className={s.steps}>
        <li><b>Hold</b>Everyone puts a PayPal hold on the jar.</li>
        <li><b>Talk</b>The AI judge listens for swears.</li>
        <li><b>Settle</b>PayPal captures only your fines. Clean mouth, nothing charged.</li>
      </ol>
      <footer className="muted small">Sandbox only. No real money.</footer>
    </main>
  );
}
