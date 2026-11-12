import type { AiMode } from "@/lib/types";

export function AiBadge({ aiMode, aiModel, aiBusy }: { aiMode: AiMode; aiModel: string | null; aiBusy?: boolean }) {
  const label =
    aiMode === "lexicon" ? "Lexicon mode" : aiMode === "local" ? "AI: local" : `AI: ${aiMode}${aiModel ? " · " + aiModel : ""}`;
  return (
    <span className="row" style={{ gap: 6 }}>
      <span className="badge" title="Which engine judges the words">🤖 {label}</span>
      {aiBusy && <span className="badge warn">AI busy — using word list</span>}
    </span>
  );
}
