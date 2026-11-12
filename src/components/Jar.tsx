"use client";
import { useMemo } from "react";
import type { Fine } from "@/lib/types";
import { tierColour } from "./helpers";

const MAX_COINS = 70;
const COLS = 6;

/** Glass jar filling with one coin per active/contested fine. Colour = tier. */
export function Jar({ fines, label }: { fines: Pick<Fine, "id" | "tierId" | "status">[]; label?: string }) {
  const coins = useMemo(() => fines.filter((f) => f.status !== "dropped"), [fines]);
  const shown = coins.slice(-MAX_COINS);
  return (
    <div className="center">
      <svg viewBox="0 0 240 300" role="img" aria-label={label ?? `Jar with ${coins.length} coins`} style={{ width: "100%", maxWidth: 300 }}>
        <defs>
          <clipPath id="jarclip">
            <path d="M52 40 H188 V54 Q206 64 206 92 V256 Q206 282 180 282 H60 Q34 282 34 256 V92 Q34 64 52 54 Z" />
          </clipPath>
        </defs>
        <rect x="46" y="14" width="148" height="26" rx="8" fill="var(--surface2)" stroke="var(--border)" strokeWidth="3" />
        <path
          d="M52 40 H188 V54 Q206 64 206 92 V256 Q206 282 180 282 H60 Q34 282 34 256 V92 Q34 64 52 54 Z"
          fill="var(--accent-soft)"
          fillOpacity="0.5"
        />
        <g clipPath="url(#jarclip)">
          {shown.map((f, i) => {
            const row = Math.floor(i / COLS);
            const col = i % COLS;
            const x = 52 + col * 27 + (row % 2 ? 13 : 0);
            const y = 262 - row * 21;
            return (
              <g key={f.id} className="coin" style={{ animationDelay: "0s" }}>
                <circle cx={x} cy={y} r="12.5" fill={tierColour(f.tierId)} stroke="rgba(0,0,0,.35)" strokeWidth="1.5" opacity={f.status === "contested" ? 0.6 : 1} />
                <circle cx={x} cy={y} r="7.5" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth="1.5" strokeDasharray={f.status === "contested" ? "3 2" : undefined} />
              </g>
            );
          })}
        </g>
        <path
          d="M52 40 H188 V54 Q206 64 206 92 V256 Q206 282 180 282 H60 Q34 282 34 256 V92 Q34 64 52 54 Z"
          fill="none"
          stroke="var(--fg)"
          strokeOpacity="0.55"
          strokeWidth="4"
        />
        <path d="M50 80 V240" stroke="#fff" strokeOpacity="0.55" strokeWidth="6" strokeLinecap="round" />
      </svg>
      <div className="muted small">
        {coins.length} {coins.length === 1 ? "coin" : "coins"} in the jar
      </div>
    </div>
  );
}
