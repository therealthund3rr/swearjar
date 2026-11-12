import type { AiMode } from "@/lib/types";

export function AiBadge({ aiMode, aiModel, aiBusy }: { aiMode: AiMode; aiModel: string | null; aiBusy?: boolean }) {
  const label =
    aiMode === "lexicon" ? "Word-list mode" : aiMode === "local" ? "AI judge: local" : `AI judge: ${aiMode === "groq" ? "Groq" : aiMode}`;
  return (
    <span className="small muted" style={{ display: "inline-flex", gap: 8, alignItems: "center" }} title={aiModel ?? undefined}>
      <span>{label}</span>
      {aiBusy && <span className="badge warn">AI busy</span>}
    </span>
  );
}
