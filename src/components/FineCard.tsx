"use client";
import { useEffect, useState } from "react";
import type { Mode, PublicSession } from "@/lib/types";
import { Money } from "./Money";

type F = PublicSession["fines"][number];

export function FineCard({
  fine,
  session,
  meId,
  serverNow,
  onObject,
  onVote,
}: {
  fine: F;
  session: PublicSession;
  meId: string;
  serverNow: () => number;
  onObject: (fineId: string) => void;
  onVote: (fineId: string, vote: "keep" | "drop") => void;
}) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const now = serverNow();
  const mode: Mode = session.jar.mode;
  const tier = session.jar.rules.tiers.find((t) => t.id === fine.tierId);
  const who = session.players[fine.playerId]?.name ?? "?";
  const slur = fine.tierId === "slur";
  const canObject = fine.status !== "dropped" && !fine.objection && now < fine.objectableUntil;
  const obj = fine.objection;
  const voting = !!obj && now < obj.deadline;
  const myVote = obj?.votes[meId];
  const secs = Math.max(0, Math.ceil(((obj?.deadline ?? 0) - now) / 1000));
  return (
    <article className={`card fine ${fine.status}`}>
      <div className="row between">
        <span className="word">{slur ? "⚠ hateful language" : fine.masked}</span>
        <Money cents={fine.priceCents} currency={session.jar.currency} />
      </div>
      <div className="row">
        <span className="badge">{tier?.label ?? fine.tierId}</span>
        <span className={`badge ${fine.status === "active" ? "good" : fine.status === "contested" ? "warn" : "bad"}`}>
          {fine.status === "active" ? "Active" : fine.status === "contested" ? "Contested" : "Dropped"}
        </span>
        {fine.multiplier > 1 && <span className="badge">×{fine.multiplier}</span>}
        <span className="muted small">{who}</span>
      </div>
      {fine.reason && <div className="small muted">{fine.reason}</div>}
      {mode === "family" && fine.alternative && !slur && <div className="small">💡 Try “{fine.alternative}” instead</div>}
      {canObject && (
        <div>
          <button className="btn sm" onClick={() => onObject(fine.id)}>
            ✋ Objection!
          </button>
        </div>
      )}
      {obj && (
        <div className="notice" role="group" aria-label="Objection vote">
          {session.players[obj.byPlayerId]?.name ?? "Someone"} objected.{" "}
          {voting ? `Vote now (${secs}s)` : "Voting closed."} Keep {Object.values(obj.votes).filter((v) => v === "keep").length} · Drop{" "}
          {Object.values(obj.votes).filter((v) => v === "drop").length}
          {voting && fine.playerId !== meId && (
            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn sm" aria-pressed={myVote === "keep"} onClick={() => onVote(fine.id, "keep")}>
                👍 Keep{myVote === "keep" ? " ✓" : ""}
              </button>
              <button className="btn sm" aria-pressed={myVote === "drop"} onClick={() => onVote(fine.id, "drop")}>
                👎 Drop{myVote === "drop" ? " ✓" : ""}
              </button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
