import { z } from "zod";
import type { Cents } from "./money";

// Base tiers always exist so the lexicon fallback can price a hit under any custom rule set.
export const BASE_TIER_IDS = ["mild", "strong", "blasphemy", "slur"] as const;
export type BaseTierId = (typeof BASE_TIER_IDS)[number];

export const TierSchema = z.object({
  id: z.string().min(1).max(32),
  label: z.string().min(1).max(60),
  price_cents: z.number().int(),
  description: z.string().max(300).default(""),
  examples: z.array(z.string().max(60)).max(10).default([]),
});

export const MultiplierSchema = z.object({
  id: z.string().min(1).max(32),
  when: z.string().max(120),
  factor: z.number(),
});

export const RuleSetSchema = z.object({
  language_hints: z.array(z.string()).default([]),
  tiers: z.array(TierSchema).min(1),
  free_terms: z.array(z.string()).default([]),
  multipliers: z.array(MultiplierSchema).default([]),
  count_mentions: z.boolean().default(false),
  notes: z.string().default(""),
});
export type RuleSet = z.infer<typeof RuleSetSchema>;
export type Tier = z.infer<typeof TierSchema>;

export const VerdictHitSchema = z.object({
  quote: z.string(),
  normalized: z.string(),
  tier_id: z.string(),
  is_mention: z.boolean(),
  confidence: z.number().min(0).max(1),
  reason: z.string().max(200),
  /** Optional cleaner word, shown on Family-mode cards ("try 'mannaggia' instead"). */
  alternative: z.string().max(60).optional(),
});
export const VerdictSchema = z.object({ hits: z.array(VerdictHitSchema) });
export type VerdictHit = z.infer<typeof VerdictHitSchema>;
export type Verdict = z.infer<typeof VerdictSchema>;

export const MAX_TIERS = 6;
export const MIN_FACTOR = 1;
export const MAX_FACTOR = 5;

export function defaultRuleSet(capCents: Cents): RuleSet {
  return normalizeRuleSet(
    {
      language_hints: ["en", "it"],
      tiers: [
        { id: "mild", label: "Mild", price_cents: 25, description: "Everyday swears (damn, crap, cavolo is free)", examples: [] },
        { id: "strong", label: "Strong", price_cents: 100, description: "Strong swears and insults", examples: [] },
        { id: "blasphemy", label: "Blasphemy", price_cents: 200, description: "Blasphemy (bestemmie)", examples: [] },
        { id: "slur", label: "Hateful language", price_cents: capCents, description: "Slurs against groups: always the maximum", examples: [] },
      ],
      free_terms: [],
      multipliers: [],
      count_mentions: false,
      notes: "Default house rules.",
    },
    capCents,
  );
}

/**
 * Hard limits enforced in code after the AI (CLAUDE.md §3.1): 1 ≤ price ≤ cap, ≤ 6 tiers,
 * factors in [1,5], base tiers always present, slur always priced at the cap.
 */
export function normalizeRuleSet(raw: RuleSet, capCents: Cents): RuleSet {
  const seen = new Set<string>();
  let tiers = raw.tiers
    .map((t) => ({ ...t, id: t.id.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_") }))
    .filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)))
    .map((t) => ({ ...t, price_cents: Math.min(capCents, Math.max(1, Math.round(t.price_cents))) }));
  const defaults: Record<BaseTierId, Tier> = {
    mild: { id: "mild", label: "Mild", price_cents: Math.min(25, capCents), description: "Mild swears", examples: [] },
    strong: { id: "strong", label: "Strong", price_cents: Math.min(100, capCents), description: "Strong swears", examples: [] },
    blasphemy: { id: "blasphemy", label: "Blasphemy", price_cents: Math.min(200, capCents), description: "Blasphemy", examples: [] },
    slur: { id: "slur", label: "Hateful language", price_cents: capCents, description: "Slurs against groups", examples: [] },
  };
  for (const id of BASE_TIER_IDS) if (!tiers.some((t) => t.id === id)) tiers.push(defaults[id]);
  tiers = tiers.map((t) => (t.id === "slur" ? { ...t, price_cents: capCents } : t));
  // Keep the base tiers when trimming to MAX_TIERS (custom extras go first).
  const base = tiers.filter((t) => (BASE_TIER_IDS as readonly string[]).includes(t.id));
  const extra = tiers.filter((t) => !(BASE_TIER_IDS as readonly string[]).includes(t.id));
  tiers = [...base, ...extra].slice(0, MAX_TIERS);
  return {
    ...raw,
    tiers,
    free_terms: raw.free_terms.map((s) => s.trim().toLowerCase()).filter(Boolean),
    multipliers: raw.multipliers.map((m) => ({ ...m, factor: Math.min(MAX_FACTOR, Math.max(MIN_FACTOR, m.factor)) })),
  };
}
