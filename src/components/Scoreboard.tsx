import type { PublicSession } from "@/lib/types";
import { Money } from "./Money";
import { owedBy } from "./helpers";

export function Scoreboard({ session, meId }: { session: PublicSession; meId: string }) {
  const { jar, fines, players } = session;
  const family = jar.mode === "family";
  const rows = Object.values(players).map((p) => ({
    p,
    owed: owedBy(p.id, fines, jar.capCents),
    count: fines.filter((f) => f.playerId === p.id && f.status !== "dropped").length,
  }));
  // Family mode: no ranking, alphabetical. Party: worst mouth first.
  rows.sort((a, b) => (family ? a.p.name.localeCompare(b.p.name) : b.owed - a.owed || a.p.name.localeCompare(b.p.name)));
  return (
    <section className="card" aria-label="Scoreboard">
      <h2>{family ? "Players" : "Scoreboard"}</h2>
      <ul className="stack" style={{ listStyle: "none", padding: 0, margin: "12px 0 0" }}>
        {rows.map(({ p, owed, count }, i) => (
          <li key={p.id} className="row between">
            <span>
              {!family && <span className="muted">{i + 1}. </span>}
              <strong>{p.name}</strong>
              {p.id === meId && <span className="muted"> (you)</span>}
              <span className="muted small"> · {count} {count === 1 ? "fine" : "fines"}</span>
            </span>
            <Money cents={owed} currency={jar.currency} />
          </li>
        ))}
      </ul>
    </section>
  );
}
