import "server-only";
import fs from "node:fs";
import path from "node:path";
import { customAlphabet } from "nanoid";
import { z } from "zod";
import { aiMode, env } from "@/lib/env";
import type { PublicSession, Receipt, Session } from "@/lib/types";

// In-memory state on a single instance, with JSON snapshots so a restart mid-demo keeps sessions.
// Kept on globalThis so Next.js dev hot-reload does not wipe it.

type Listener = (s: PublicSession, viewer: string | null) => void;
type Store = {
  sessions: Map<string, Session>;
  receipts: Map<string, Receipt>;
  listeners: Map<string, Set<{ viewer: string | null; fn: Listener }>>;
  loaded: boolean;
  saveTimer: ReturnType<typeof setTimeout> | null;
};

const g = globalThis as unknown as { __swearjar?: Store };
const store: Store = (g.__swearjar ??= {
  sessions: new Map(),
  receipts: new Map(),
  listeners: new Map(),
  loaded: false,
  saveTimer: null,
});

export const newJarCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);
export const newId = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 12);

const DAY = 24 * 60 * 60 * 1000;

function snapshotFile() {
  return path.join(env().dataDir, "snapshot.json");
}

function load() {
  if (store.loaded) return;
  store.loaded = true;
  try {
    const raw = JSON.parse(fs.readFileSync(snapshotFile(), "utf8")) as { sessions: Session[]; receipts: Receipt[] };
    const now = Date.now();
    for (const s of raw.sessions ?? []) {
      if (s.endedAt && now - s.endedAt > DAY) continue; // transcripts/fines deleted 24 h after end
      store.sessions.set(s.jar.code, { ...s, context: {} });
    }
    for (const r of raw.receipts ?? []) store.receipts.set(r.id, r);
  } catch {
    // no snapshot yet
  }
}

function scheduleSave() {
  if (store.saveTimer) return;
  store.saveTimer = setTimeout(() => {
    store.saveTimer = null;
    try {
      fs.mkdirSync(env().dataDir, { recursive: true });
      const sessions = [...store.sessions.values()].map((s) => ({ ...s, context: {} })); // never persist raw text
      const tmp = snapshotFile() + ".tmp";
      fs.writeFileSync(tmp, JSON.stringify({ sessions, receipts: [...store.receipts.values()] }));
      fs.renameSync(tmp, snapshotFile());
    } catch (err) {
      console.error("snapshot failed", (err as Error).message);
    }
  }, 500);
}

export function getSession(code: string): Session | undefined {
  load();
  return store.sessions.get(code.toUpperCase());
}

export function createSession(session: Session): Session {
  load();
  store.sessions.set(session.jar.code, session);
  commit(session.jar.code);
  return session;
}

/**
 * The only way to change a session: mutate inside `fn`, then it is snapshotted and broadcast.
 * Synchronous on purpose: no await inside, so two requests never interleave half-way.
 */
export function mutate<T>(code: string, fn: (s: Session) => T): T {
  const s = getSession(code);
  if (!s) throw new HttpError(404, "Jar not found");
  const out = fn(s);
  commit(s.jar.code);
  return out;
}

function commit(code: string) {
  scheduleSave();
  const s = store.sessions.get(code);
  const subs = store.listeners.get(code);
  if (!s || !subs) return;
  for (const sub of subs) {
    try {
      sub.fn(publicView(s, sub.viewer), sub.viewer);
    } catch {
      // a dead SSE stream; it unsubscribes itself on close
    }
  }
}

export function subscribe(code: string, viewer: string | null, fn: Listener): () => void {
  const key = code.toUpperCase();
  const set = store.listeners.get(key) ?? new Set();
  const entry = { viewer, fn };
  set.add(entry);
  store.listeners.set(key, set);
  return () => set.delete(entry);
}

export function saveReceipt(r: Receipt) {
  store.receipts.set(r.id, r);
  scheduleSave();
}

export function getReceipt(id: string): Receipt | undefined {
  load();
  return store.receipts.get(id);
}

/** Client view: no transcript context, quotes masked except the viewer's own. */
export function publicView(s: Session, viewer: string | null): PublicSession {
  const { context: _context, fines, ...rest } = s;
  void _context;
  const mode = aiMode();
  return {
    ...rest,
    fines: fines.map(({ quote, ...f }) => (viewer && f.playerId === viewer && f.tierId !== "slur" ? { ...f, quote } : f)),
    aiMode: mode,
    aiModel: mode === "lexicon" ? null : env().aiModelFast,
    now: Date.now(),
  };
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Wrap a route handler: HttpError -> JSON error with status; anything else -> 500 without internals. */
export async function handle(fn: () => Promise<unknown> | unknown): Promise<Response> {
  try {
    const out = await fn();
    return out instanceof Response ? out : Response.json(out ?? { ok: true });
  } catch (err) {
    if (err instanceof HttpError) return Response.json({ error: err.message }, { status: err.status });
    if (err instanceof z.ZodError) return Response.json({ error: "Invalid request" }, { status: 400 });
    // PayPalError messages carry only status, error name and debug id (never tokens): safe to show.
    if (err instanceof Error && err.name === "PayPalError") {
      console.error(err.message);
      return Response.json({ error: err.message }, { status: 502 });
    }
    console.error(err);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}

export function requirePlayer(s: Session, playerId: unknown) {
  const p = typeof playerId === "string" ? s.players[playerId] : undefined;
  if (!p) throw new HttpError(403, "Unknown player");
  return p;
}

export function requireCreator(s: Session, playerId: unknown) {
  const p = requirePlayer(s, playerId);
  if (!p.isCreator) throw new HttpError(403, "Only the jar creator can do this");
  return p;
}
