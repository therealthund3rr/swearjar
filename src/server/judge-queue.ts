import "server-only";
import { aiMode } from "@/lib/env";
import { resolveObjections, verdictToFines } from "@/lib/fines";
import { lexiconScan } from "@/lib/lexicon";
import type { VerdictHit } from "@/lib/rules";
import type { Fine, Session } from "@/lib/types";
import { judgeBatch, type JudgeItem } from "@/server/ai";
import { getSession, HttpError, mutate, newId } from "@/server/store";

// Per-session batching so the free AI tier is hit at most once every ~3 s (CLAUDE.md §3.5).
// Lives on globalThis so Next.js dev hot-reload does not orphan timers or pending items.

const FIRST_WAIT_MS = 1500;
const MIN_GAP_MS = 3000;
const AI_OBJECTION_MS = 20_000;
const RESOLVE_EVERY_MS = 2000;

type Pending = JudgeItem & { index: number; ts: number };
type Q = {
  pending: Pending[];
  timer: ReturnType<typeof setTimeout> | null;
  flushing: boolean;
  lastFlushAt: number;
  resolver: ReturnType<typeof setInterval> | null;
};
const g = globalThis as unknown as { __swearjarQueues?: Map<string, Q> };
const queues = (g.__swearjarQueues ??= new Map<string, Q>());

function queueFor(code: string): Q {
  let q = queues.get(code);
  if (!q) {
    q = { pending: [], timer: null, flushing: false, lastFlushAt: 0, resolver: null };
    queues.set(code, q);
  }
  return q;
}

function stop(code: string) {
  const q = queues.get(code);
  if (!q) return;
  if (q.timer) clearTimeout(q.timer);
  if (q.resolver) clearInterval(q.resolver);
  queues.delete(code);
}

/** Votes time out on the clock, not only when someone votes: tick every 2 s while the session lives. */
export function ensureResolver(code: string) {
  const q = queueFor(code);
  if (q.resolver) return;
  q.resolver = setInterval(() => {
    const s = getSession(code);
    if (!s || s.status === "ended") return stop(code);
    if (s.status !== "live") return;
    const ids = Object.keys(s.players);
    const next = resolveObjections(s.fines, ids, Date.now(), false);
    if (JSON.stringify(next) === JSON.stringify(s.fines)) return;
    mutate(code, (m) => {
      m.fines = resolveObjections(m.fines, Object.keys(m.players), Date.now(), false);
    });
  }, RESOLVE_EVERY_MS);
  q.resolver.unref?.();
}

function schedule(code: string) {
  const q = queueFor(code);
  if (q.timer || q.flushing || q.pending.length === 0) return;
  const delay = Math.max(FIRST_WAIT_MS, q.lastFlushAt + MIN_GAP_MS - Date.now());
  q.timer = setTimeout(() => {
    q.timer = null;
    void flush(code);
  }, delay);
  q.timer.unref?.();
}

export function enqueueUtterance(code: string, playerId: string, text: string, ts: number): { maybe: number } {
  const maybe = mutate(code, (s) => {
    if (s.status !== "live") throw new HttpError(409, "The session is not live");
    const player = s.players[playerId];
    if (!player) throw new HttpError(403, "Unknown player");
    const index = s.utteranceCounter[playerId] ?? 0;
    s.utteranceCounter[playerId] = index + 1;
    const ctx = s.context[playerId] ?? [];
    queueFor(s.jar.code).pending.push({
      key: `${playerId}:${index}`,
      playerId,
      index,
      ts,
      lang: player.lang,
      text,
      context: ctx.slice(-2),
    });
    // Raw text lives only in this 3-item window; non-fined text is never stored elsewhere.
    s.context[playerId] = [...ctx, text].slice(-3);
    return lexiconScan(text, s.jar.rules).length;
  });
  ensureResolver(code);
  schedule(code);
  return { maybe };
}

async function flush(code: string) {
  const q = queues.get(code);
  if (!q || q.flushing) return;
  const batch = q.pending.splice(0);
  if (batch.length === 0) return;
  const s0 = getSession(code);
  if (!s0 || s0.status !== "live") return stop(code);
  q.flushing = true;
  q.lastFlushAt = Date.now();
  try {
    const verdict = await judgeBatch(batch, s0.jar.rules, s0.jar.mode);
    mutate(code, (s) => {
      if (s.status !== "live") return; // ended meanwhile: discard
      applyVerdicts(s, batch, verdict.results, verdict.source);
    });
  } catch (err) {
    console.error("judge flush failed", (err as Error).message);
  } finally {
    q.flushing = false;
    schedule(code);
  }
}

function applyVerdicts(
  s: Session,
  batch: Pending[],
  results: Record<string, VerdictHit[]>,
  source: "ai" | "lexicon",
) {
  const now = Date.now();
  const factor = s.jar.rules.multipliers.find((m) => m.id === s.activeMultiplierId)?.factor ?? 1;
  const contest = (f: Fine) => {
    f.status = "contested";
    f.objection ??= { byPlayerId: "ai", votes: {}, deadline: now + AI_OBJECTION_MS };
  };
  for (const item of batch) {
    const hits = results[item.key] ?? [];
    if (hits.length === 0 || !s.players[item.playerId]) continue;
    const out = verdictToFines({
      playerId: item.playerId,
      utteranceIndex: item.index,
      ts: item.ts,
      hits,
      rules: s.jar.rules,
      multiplier: factor,
      capCents: s.jar.capCents,
      existingFines: s.fines, // grows per item so dedupe and the cap see earlier fines of this batch
      source,
      mode: s.jar.mode,
      newId,
    });
    for (const f of out.fines) {
      if (f.status === "contested") contest(f);
      s.fines.push(f);
    }
    for (const id of out.contestedIds) {
      const f = s.fines.find((x) => x.id === id);
      if (f && f.status !== "dropped") contest(f);
    }
  }
  s.aiBusy = source === "lexicon" && aiMode() !== "lexicon";
}
