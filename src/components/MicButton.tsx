"use client";
import type { MicStatus } from "@/lib/client/speech";
import css from "./MicButton.module.css";

/** Round record-style button. Props unchanged. */
export function MicButton({ status, onStart, onStop }: { status: MicStatus; onStart: () => void; onStop: () => void }) {
  if (status === "unsupported") {
    return (
      <div className={css.note} role="status">
        Mic not supported here, type instead. (Chrome or Edge have it.)
      </div>
    );
  }
  const on = status === "listening";
  const restarting = status === "restarting";
  const active = on || restarting;
  const label = on ? "Listening" : restarting ? "Restarting…" : "Tap to start listening";
  const hint = active
    ? "Tap to stop"
    : status === "denied"
      ? "Mic blocked: allow it in the browser, or type below"
      : "Only the finished text is sent, never audio";
  return (
    <div className={css.wrap} role="status" aria-live="polite">
      <button className={`btn ${css.rec} ${on ? css.on : ""} ${active ? "" : "primary"}`} onClick={active ? onStop : onStart} aria-pressed={active}>
        <span className={css.disc} aria-hidden="true">
          <span className={css.core} style={restarting ? { background: "#ff8a00" } : undefined} />
        </span>
        <span>
          <span className={css.label}>{label}</span>
          <br />
          <span className={css.hint}>{hint}</span>
        </span>
      </button>
    </div>
  );
}
