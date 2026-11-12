// Turns judge verdicts into priced fines (CLAUDE.md §3.2 step 3-4, §3.4, §4.1). Pure, no I/O.
// The AI only classifies; every amount is computed here.
import { clampToCap, scaleCents, sumCents, type Cents } from "./money";
import { maskWord, normalizeText } from "./lexicon";
import type { RuleSet, VerdictHit } from "./rules";
import type { Fine, Mode } from "./types";

export const OBJECTION_WINDOW_MS = 30_000;
export const VOTE_TIMEOUT_MS = 20_000;
const CROSS_TALK_MS = 3_000;

export function owedCents(playerId: string, fines: Fine[], capCents: Cents): Cents {
  const sum = sumCents(fines.filter((f) => f.playerId === playerId && f.status !== "dropped").map((f) => f.priceCents));
  return Math.min(sum, capCents);
}

export function verdictToFines(args: {
  playerId: string;
  utteranceIndex: number;
  ts: number;
  hits: VerdictHit[];
  rules: RuleSet;
  multiplier: number;
  capCents: Cents;
  existingFines: Fine[];
  source: "ai" | "lexicon";
  mode: Mode;
  newId: () => string;
}): { fines: Fine[]; contestedIds: string[] } {
  const { playerId, utteranceIndex, ts, rules, multiplier, capCents, source, newId } = args;
  const created: Fine[] = [];
  const contested = new Set<string>();
  const free = new Set(rules.free_terms.map(normalizeText));

  for (const hit of args.hits) {
    const tier = rules.tiers.find((t) => t.id === hit.tier_id);
    if (!tier) continue;
    if (hit.is_mention && !rules.count_mentions) continue;
    if (free.has(normalizeText(hit.normalized))) continue;
    if (hit.confidence < 0.5) continue;

    const all = [...args.existingFines, ...created];
    // Same quote in the same utterance is never fined twice (dropped fines count: a dropped fine stays dropped).
    if (all.some((f) => f.playerId === playerId && f.utteranceIndex === utteranceIndex && f.normalized === hit.normalized && f.quote === hit.quote)) continue;

    // Cross-talk / echo guard: the earliest device wins, the other player's copy is dropped.
    const others = all.filter((f) => f.playerId !== playerId && f.status !== "dropped" && f.normalized === hit.normalized && Math.abs(f.ts - ts) <= CROSS_TALK_MS);
    const earlier = others.filter((f) => f.ts <= ts);
    if (earlier.length > 0) {
      for (const f of earlier) contested.add(f.id);
      continue;
    }
    const crossTalk = others.length > 0;
    for (const f of others) contested.add(f.id);

    const isSlur = tier.id === "slur";
    const raw = isSlur ? capCents : scaleCents(Math.max(0, tier.price_cents), multiplier);
    const priceCents = clampToCap(raw, owedCents(playerId, all, Infinity), capCents);
    const lowConfidence = hit.confidence < 0.75;

    created.push({
      id: newId(),
      playerId,
      utteranceIndex,
      quote: hit.quote,
      masked: isSlur ? "⚠ hateful language" : maskWord(hit.quote),
      normalized: hit.normalized,
      tierId: tier.id,
      priceCents,
      multiplier,
      confidence: hit.confidence,
      reason: isSlur ? "Hateful language" : hit.reason,
      ...(hit.alternative ? { alternative: hit.alternative } : {}),
      status: lowConfidence || crossTalk ? "contested" : "active",
      objection: lowConfidence || crossTalk ? { byPlayerId: "ai", votes: {}, deadline: ts + VOTE_TIMEOUT_MS } : null,
      source,
      ts,
      objectableUntil: ts + OBJECTION_WINDOW_MS,
    });
  }
  return { fines: created, contestedIds: [...contested] };
}

/** True while an objection vote is still open. */
export function objectionPending(f: Fine, now: number): boolean {
  return f.objection !== null && f.status === "contested" && now < f.objection.deadline;
}

/** CLAUDE.md §3.4. Returns a new array; resolved fines change status only (objection kept for history). */
export function resolveObjections(fines: Fine[], players: string[], now: number, force: boolean): Fine[] {
  return fines.map((f) => {
    const o = f.objection;
    if (!o || f.status === "dropped") return f;
    const others = players.filter((p) => p !== f.playerId);
    const byConfidence = f.confidence >= 0.75 ? "active" : "dropped";
    const due = force || now >= o.deadline;

    if (others.length === 0) {
      if (!due) return f;
      const self = o.votes[f.playerId];
      return { ...f, status: self === "drop" ? "dropped" : self === "keep" ? "active" : byConfidence };
    }
    const allVoted = others.every((p) => o.votes[p] !== undefined);
    if (!allVoted && !due) return f;
    let keep = 0;
    let drop = 0;
    for (const p of others) {
      if (o.votes[p] === "keep") keep++;
      else if (o.votes[p] === "drop") drop++;
    }
    const status = drop > keep ? "dropped" : keep > drop ? "active" : byConfidence;
    return { ...f, status };
  });
}
