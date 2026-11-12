"use client";
import type { MicStatus } from "@/lib/client/speech";

const LABEL: Record<MicStatus, string> = {
  off: "Mic off",
  listening: "Listening",
  restarting: "Restarting…",
  denied: "Mic blocked — allow it in the browser, or use the text box",
  unsupported: "Use Chrome or Edge for the mic — type mode is on",
};

export function MicButton({ status, onStart, onStop }: { status: MicStatus; onStart: () => void; onStop: () => void }) {
  const on = status === "listening" || status === "restarting";
  const cls = status === "listening" ? "on" : status === "restarting" ? "warn" : status === "denied" ? "bad" : "";
  return (
    <div className="row" role="status" aria-live="polite">
      <span className={`dot ${cls}`} aria-hidden="true" />
      <strong>{LABEL[status]}</strong>
      {status !== "unsupported" &&
        (on ? (
          <button className="btn sm" onClick={onStop}>
            Stop
          </button>
        ) : (
          <button className="btn sm primary" onClick={onStart}>
            🎙 Start
          </button>
        ))}
    </div>
  );
}
