"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import type { Fine } from "@/lib/types";
import { tierColour } from "./helpers";
import css from "./Jar.module.css";

const MAX_COINS = 66;
const COLS = 6;
const INK = "var(--ink)";
const BODY = "M52 52 H188 V62 Q208 72 208 100 V256 Q208 284 180 284 H60 Q32 284 32 256 V100 Q32 72 52 62 Z";

type Pos = { x: number; y: number; colour: string };
type Ghost = Pos & { id: string };

function reduced() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Chunky glass jar. One flat coin per active/contested fine, coloured by tier. */
export function Jar({
  fines,
  label,
  compact,
}: {
  fines: Pick<Fine, "id" | "tierId" | "status">[];
  label?: string;
  compact?: boolean;
}) {
  const coins = useMemo(() => fines.filter((f) => f.status !== "dropped"), [fines]);
  const shown = useMemo(() => coins.slice(-MAX_COINS), [coins]);
  const svgRef = useRef<SVGSVGElement>(null);
  const jarRef = useRef<SVGGElement>(null);
  const seen = useRef<Set<string> | null>(null);
  const prevPos = useRef<Map<string, Pos>>(new Map());
  const [ghosts, setGhosts] = useState<Ghost[]>([]);

  const layout = useMemo(() => {
    const m = new Map<string, Pos>();
    shown.forEach((f, i) => {
      const row = Math.floor(i / COLS);
      const col = i % COLS;
      m.set(f.id, { x: 53 + col * 27 + (row % 2 ? 13 : 0), y: 264 - row * 21, colour: tierColour(f.tierId) });
    });
    return m;
  }, [shown]);

  useEffect(() => {
    const ids = new Set(shown.map((f) => f.id));
    const previous = seen.current;
    seen.current = ids;
    const old = prevPos.current;
    prevPos.current = layout;
    if (previous === null) return; // first paint: nothing animates
    const fresh = shown.filter((f) => !previous.has(f.id)).map((f) => f.id);
    const gone = [...previous].filter((id) => !ids.has(id) && old.has(id));
    if (reduced()) return;
    const root = svgRef.current;
    if (root && fresh.length) {
      fresh.slice(-4).forEach((id, n) => {
        const el = root.querySelector<SVGGElement>(`[data-coin="${CSS.escape(id)}"]`);
        if (!el) return;
        gsap.set(el, { transformBox: "fill-box", transformOrigin: "50% 100%" });
        const tl = gsap.timeline({ delay: n * 0.18 });
        tl.fromTo(el, { y: -260, opacity: 0, scaleY: 1 }, { y: 0, opacity: 1, duration: 0.3, ease: "power2.in" })
          .to(el, { scaleY: 0.78, scaleX: 1.12, duration: 0.06 })
          .to(el, { y: -26, scaleY: 1, scaleX: 1, duration: 0.14, ease: "power1.out" })
          .to(el, { y: 0, duration: 0.14, ease: "power1.in" })
          .to(el, { scaleY: 0.9, scaleX: 1.05, duration: 0.05 })
          .to(el, { scaleY: 1, scaleX: 1, duration: 0.1 });
      });
      if (jarRef.current) {
        gsap.to(jarRef.current, {
          keyframes: [{ rotation: -1.4 }, { rotation: 1.2 }, { rotation: -0.6 }, { rotation: 0 }],
          duration: 0.4,
          delay: 0.3,
          svgOrigin: "120 284",
        });
      }
    }
    if (gone.length) setGhosts(gone.map((id) => ({ id, ...old.get(id)! })));
  }, [shown, layout]);

  useEffect(() => {
    if (!ghosts.length || !svgRef.current) return;
    const els = svgRef.current.querySelectorAll<SVGGElement>("[data-ghost]");
    gsap.set(els, { transformBox: "fill-box", transformOrigin: "50% 50%" });
    const tween = gsap.to(els, {
      y: -40,
      scale: 1.4,
      opacity: 0,
      duration: 0.5,
      ease: "power2.out",
      onComplete: () => setGhosts([]),
    });
    return () => {
      tween.kill();
    };
  }, [ghosts]);

  const text = { fontFamily: "var(--font-sans)", fontWeight: 900, fontSize: 21, fontStretch: "68%" } as const;
  return (
    <div className={css.wrap}>
      <svg
        ref={svgRef}
        viewBox="0 -10 240 300"
        className={`${css.svg} ${compact ? css.compact : ""}`}
        role="img"
        aria-label={label ?? `Jar with ${coins.length} coins`}
      >
        <defs>
          <clipPath id="jarclip">
            <path d={BODY} />
          </clipPath>
        </defs>
        <g ref={jarRef}>
          <path d={BODY} fill="#fff" fillOpacity="0.55" />
          <g clipPath="url(#jarclip)">
            {shown.map((f) => {
              const p = layout.get(f.id)!;
              return (
                <g key={f.id} data-coin={f.id} opacity={f.status === "contested" ? 0.6 : 1}>
                  <circle cx={p.x} cy={p.y} r="12" fill={p.colour} stroke={INK} strokeWidth="3" />
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r="6"
                    fill="none"
                    stroke={INK}
                    strokeOpacity="0.35"
                    strokeWidth="2"
                    strokeDasharray={f.status === "contested" ? "3 2" : undefined}
                  />
                </g>
              );
            })}
          </g>
          {ghosts.map((g) => (
            <g key={g.id} data-ghost>
              <circle cx={g.x} cy={g.y} r="12" fill={g.colour} stroke={INK} strokeWidth="3" />
            </g>
          ))}
          <g transform="rotate(-2 120 190)">
            <rect x="58" y="160" width="124" height="52" rx="6" fill="var(--paper)" stroke={INK} strokeWidth="4" />
            <text x="120" y="184" textAnchor="middle" style={text} fill={INK} letterSpacing="1">
              SWEAR
            </text>
            <text x="120" y="205" textAnchor="middle" style={text} fill="var(--bleep)" letterSpacing="3">
              JAR
            </text>
          </g>
          <path d={BODY} fill="none" stroke={INK} strokeWidth="6" strokeLinejoin="round" />
          <path d="M48 104 V150" stroke="#fff" strokeOpacity="0.85" strokeWidth="7" strokeLinecap="round" />
          <path d="M48 222 V240" stroke="#fff" strokeOpacity="0.85" strokeWidth="7" strokeLinecap="round" />
          <rect x="44" y="26" width="152" height="30" rx="8" fill="var(--bleep)" stroke={INK} strokeWidth="6" />
          <path d="M60 36 H180" stroke="#fff" strokeOpacity="0.5" strokeWidth="4" strokeLinecap="round" />
        </g>
      </svg>
      <div className={`${css.count} muted`}>
        {coins.length} {coins.length === 1 ? "coin" : "coins"} in the jar
      </div>
    </div>
  );
}
