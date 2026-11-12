import type { PublicSession } from "@/lib/types";
import { Money } from "./Money";
import { owedBy } from "./helpers";
import css from "./Scoreboard.module.css";

/** Compact league table: worst mouth first. */
export function Scoreboard({ session, meId }: { session: PublicSession; meId: string }) {
  const { jar, fines, players } = session;
  const rows = Object.values(players).map((p) => ({
    p,
    owed: owedBy(p.id, fines, jar.capCents),
    count: fines.filter((f) => f.playerId === p.id && f.status !== "dropped").length,
  }));
  rows.sort((a, b) => b.owed - a.owed || a.p.name.localeCompare(b.p.name));
  return (
    <section className="card" aria-label="Scoreboard">
      <h2>Scoreboard</h2>
      <ol className={css.list}>
        {rows.map(({ p, owed, count }, i) => (
          <li key={p.id} className={`${css.rowi} ${p.id === meId ? css.me : ""}`}>
            <span className={css.rank}>{i + 1}</span>
            <span className={css.name}>
              {p.name}
              {p.id === meId && <span className={css.sub}>you</span>}
              <span className={css.sub}>
                {count} {count === 1 ? "fine" : "fines"}
              </span>
              {p.hold?.status === "on_hold" && <span className={`badge hold ${css.tiny}`}>On hold</span>}
            </span>
            <span className={css.total}>
              <Money cents={owed} currency={jar.currency} />
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
