# API contract

All routes are JSON. Errors: `{ "error": string }` with a 4xx/5xx status. There is no login: the browser keeps its `playerId` (returned when creating or joining a jar) in localStorage and sends it in each body. Amounts are integer cents.

Every route handler is wrapped with `handle()` from `src/server/store.ts` and changes state only through `mutate(code, fn)` (synchronous, no `await` inside), which snapshots and broadcasts the new state over SSE.

| Method | Path | Body | Returns | Owner |
|---|---|---|---|---|
| POST | `/api/jars` | `{ name, mode: "party"\|"family", capCents, rulesText, creatorName, creatorLang, beneficiaryEmail? }` | `{ code, playerId, rules, aiMode }` (rules compiled by AI, not yet confirmed) | ai agent |
| POST | `/api/jars/[code]/rules` | `{ playerId, action: "recompile", rulesText }` or `{ playerId, action: "confirm" }` | `{ rules, rulesConfirmed }` (creator only) | ai agent |
| POST | `/api/jars/[code]/players` | `{ name, lang, sponsorId? }` | `{ playerId }`. `sponsorId` only in family mode, must be a player with no sponsor | lead |
| GET | `/api/sessions/[code]?playerId=` | – | `PublicSession` | lead |
| GET | `/api/sessions/[code]/events?playerId=` | – | SSE: `event: state`, `data: PublicSession` on connect and on every change; `: ping` every 15 s | lead |
| POST | `/api/paypal/orders` | `{ code, playerId }` | `{ orderId }`. Creates an `AUTHORIZE` order for the player's hold amount | paypal agent |
| POST | `/api/paypal/orders/[orderId]/authorize` | `{ code, playerId }` | `{ status: "on_hold", authorizationId, amountCents }` | paypal agent |
| POST | `/api/sessions/[code]/start` | `{ playerId }` | `{ ok }` creator only, rules confirmed, ≥1 hold | lead |
| POST | `/api/sessions/[code]/utterances` | `{ playerId, text, ts }` | `{ accepted: true, maybe: number }` (`maybe` = lexicon hits, instant) | ai agent |
| POST | `/api/sessions/[code]/objections` | `{ playerId, fineId, action: "object" }` or `{ playerId, fineId, action: "vote", vote: "keep"\|"drop" }` | `{ ok }` | ai agent |
| POST | `/api/sessions/[code]/multiplier` | `{ playerId, multiplierId: string\|null }` | `{ ok }` creator only | ai agent |
| POST | `/api/sessions/[code]/end` | `{ playerId }` | `{ results: SettleResult[], receiptId }`. Idempotent: calling again retries only `settle_failed` players | lead (calls `settleSession`) |
| GET | `/api/receipts/[id]` | – | `Receipt` | lead |
| GET | `/api/health` | – | `{ ok, ai: AiMode, model, paypal: boolean, currency }` (never a key) | ai agent |
| GET | `/api/config` | – | `{ paypalClientId, currency, beneficiaryName, aiMode }` public values for the browser | lead |

## Module signatures (owners must keep these exact)

```ts
// src/lib/lexicon.ts  (lexicon agent)
export function normalizeText(s: string): string;          // lowercase, strip accents, collapse repeats, leetspeak
export function maskWord(word: string): string;            // "cazzo" -> "c***o", keeps first+last letter
export function lexiconScan(text: string, rules: RuleSet): VerdictHit[]; // confidence 0.8, tier ids from BASE_TIER_IDS

// src/lib/fines.ts  (lexicon agent) — pure, no I/O
export function verdictToFines(args: {
  playerId: string; utteranceIndex: number; ts: number; hits: VerdictHit[];
  rules: RuleSet; multiplier: number; capCents: Cents; existingFines: Fine[];
  source: "ai" | "lexicon"; mode: Mode; newId: () => string;
}): { fines: Fine[]; contestedIds: string[] };   // contestedIds: existing fines to flip to "contested" (cross-talk)
export function owedCents(playerId: string, fines: Fine[], capCents: Cents): Cents; // active+contested, ≤ cap
export function resolveObjections(fines: Fine[], players: string[], now: number, force: boolean): Fine[]; // §3.4
export const OBJECTION_WINDOW_MS = 30_000, VOTE_TIMEOUT_MS = 20_000;

// src/server/paypal.ts  (paypal agent)
export function createAuthorizeOrder(a: { amountCents: Cents; currency: string; payeeEmail: string | null; description: string; requestId: string }): Promise<{ orderId: string }>;
export function authorizeOrder(orderId: string, requestId: string): Promise<{ authorizationId: string; amountCents: Cents; status: string }>;
export function captureAuthorization(authId: string, a: { amountCents: Cents; currency: string; requestId: string }): Promise<{ captureId: string; status: string; amountCents: Cents }>;
export function voidAuthorization(authId: string, requestId: string): Promise<void>;

// src/server/settle.ts  (paypal agent)
export function settleSession(code: string, deps?: { paypal?: PayPalClient }): Promise<SettleResult[]>;

// src/server/ai.ts  (ai agent)
export function compileRules(rulesText: string, capCents: Cents, mode: Mode): Promise<RuleSet>; // falls back to defaultRuleSet
export function judgeBatch(items: { key: string; playerId: string; lang: string; text: string; context: string[] }[], rules: RuleSet, mode: Mode): Promise<{ results: Record<string, VerdictHit[]>; source: "ai" | "lexicon" }>;
export function sessionReports(session: Session): Promise<Record<string, PlayerReport>>; // template if no AI

// src/server/judge-queue.ts  (ai agent)
export function enqueueUtterance(code: string, playerId: string, text: string, ts: number): { maybe: number };
```
