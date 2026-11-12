"use client";
import { useEffect, useState } from "react";
import type { Mode, PublicSession } from "@/lib/types";
import { Money } from "./Money";
import css from "./FineCard.module.css";

type F = PublicSession["fines"][number];

/** A penalty slip: the barred word, the price, and a quiet reason. */
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
  const dropped = fine.status === "dropped";
  const canObject = !dropped && !fine.objection && now < fine.objectableUntil;
  const obj = fine.objection;
  const voting = !!obj && now < obj.deadline;
  const myVote = obj?.votes[meId];
  const secs = Math.max(0, Math.ceil(((obj?.deadline ?? 0) - now) / 1000));
  const keeps = obj ? Object.values(obj.votes).filter((v) => v === "keep").length : 0;
  const drops = obj ? Object.values(obj.votes).filter((v) => v === "drop").length : 0;
  return (
    <article className={`card ${css.slip} ${dropped ? css.dropped : ""}`}>
      <div className={css.top}>
        <span className={`censor ${css.bar} ${dropped ? css.struck : ""}`}>{slur ? "hateful language" : fine.masked}</span>
        <span className={`${css.price} ${dropped ? css.struck : ""}`}>
          <Money cents={fine.priceCents} currency={session.jar.currency} />
        </span>
      </div>
      <div className={css.meta}>
        <span className={css.who}>{who}</span>
        <span className="badge">{tier?.label ?? fine.tierId}</span>
        {fine.multiplier > 1 && <span className="badge warn">x{fine.multiplier}</span>}
        {fine.status === "contested" && <span className="badge warn">Under review</span>}
        {dropped && <span className="badge bad">Dropped</span>}
        {canObject && (
          <button className={css.pill} onClick={() => onObject(fine.id)}>
            Objection!
          </button>
        )}
      </div>
      {fine.reason && <div className={css.reason}>{fine.reason}</div>}
      {mode === "family" && fine.alternative && !slur && <div className={css.reason}>Try &ldquo;{fine.alternative}&rdquo; instead</div>}
      {obj && (
        <div className={css.vote} role="group" aria-label="Objection vote">
          <span>
            {session.players[obj.byPlayerId]?.name ?? "Someone"} objected. {voting ? `Vote now (${secs}s)` : "Voting closed."} Keep {keeps}, drop {drops}.
          </span>
          {voting && fine.playerId !== meId && (
            <div className="row">
              <button className={`btn sm ${myVote === "keep" ? css.pressed : ""}`} aria-pressed={myVote === "keep"} onClick={() => onVote(fine.id, "keep")}>
                Keep
              </button>
              <button className={`btn sm ${myVote === "drop" ? css.pressed : ""}`} aria-pressed={myVote === "drop"} onClick={() => onVote(fine.id, "drop")}>
                Drop
              </button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
