import "server-only";
import { owedCents, resolveObjections } from "@/lib/fines";
import { sumCents, type Cents } from "@/lib/money";
import type { Receipt, SettleResult, Session } from "@/lib/types";
import { mutate, newId, saveReceipt } from "./store";
import { paypal, type PayPalClient } from "./paypal";

const inflight = new Map<string, Promise<SettleResult[]>>();

/** Idempotent end-of-session settlement. A concurrent call for the same jar shares the running promise. */
export function settleSession(code: string, deps: { paypal?: PayPalClient } = {}): Promise<SettleResult[]> {
  const key = code.toUpperCase();
  const running = inflight.get(key);
  if (running) return running;
  const p = run(key, deps.paypal ?? paypal).finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

type Job = { payerId: string; authId: string; owed: Cents; currency: string };

function safeMessage(err: unknown): string {
  // PayPalError messages contain only status/name/debug id; still cap the length.
  return (err instanceof Error ? err.message : "PayPal call failed").slice(0, 300);
}

async function run(code: string, client: PayPalClient): Promise<SettleResult[]> {
  // (a) freeze the session and compute what each payer owes, all synchronously.
  const jobs = mutate(code, (s): Job[] => {
    if (s.status === "lobby") return []; // nothing was played; do not settle a session that never started
    if (s.status === "live") {
      s.status = "settling";
      s.endedAt = Date.now();
    }
    s.endedAt ??= Date.now();
    s.fines = resolveObjections(s.fines, Object.keys(s.players), Date.now(), true);
    const out: Job[] = [];
    for (const payer of Object.values(s.players)) {
      const h = payer.hold;
      if (!h || !h.authorizationId || (h.status !== "on_hold" && h.status !== "settle_failed")) continue;
      const covered = [payer.id, ...Object.values(s.players).filter((p) => p.sponsorId === payer.id).map((p) => p.id)];
      const owed = Math.min(sumCents(covered.map((id) => owedCents(id, s.fines, s.jar.capCents))), h.amountCents);
      out.push({ payerId: payer.id, authId: h.authorizationId, owed, currency: s.jar.currency });
    }
    return out;
  });

  // (b) one PayPal call per payer; the result is stored right after each call.
  for (const job of jobs) {
    const requestId = `${code}:${job.payerId}:${job.authId}`; // authId in the key: a key is never reused for another authorization
    try {
      if (job.owed > 0) {
        const r = await client.captureAuthorization(job.authId, {
          amountCents: job.owed,
          currency: job.currency,
          requestId: `${requestId}:capture`,
        });
        mutate(code, (s) => {
          const h = s.players[job.payerId].hold!;
          h.status = "captured";
          h.captureId = r.captureId;
          h.capturedCents = r.amountCents;
          delete h.error;
          s.settle[job.payerId] = { playerId: job.payerId, status: "captured", amountCents: r.amountCents, captureId: r.captureId };
        });
      } else {
        await client.voidAuthorization(job.authId, `${requestId}:void`);
        mutate(code, (s) => {
          const h = s.players[job.payerId].hold!;
          h.status = "voided";
          h.voidedAt = Date.now();
          delete h.error;
          s.settle[job.payerId] = { playerId: job.payerId, status: "voided", amountCents: 0 };
        });
      }
    } catch (err) {
      const message = safeMessage(err);
      mutate(code, (s) => {
        const h = s.players[job.payerId].hold!;
        h.status = "settle_failed";
        h.error = message;
        s.settle[job.payerId] = { playerId: job.payerId, status: "settle_failed", amountCents: job.owed, error: message };
      });
    }
  }

  // (c) finish: ended once nobody is left to settle; receipt is (re)saved either way.
  return mutate(code, (s) => {
    const results = collect(s);
    const pending = Object.values(s.players).some((p) => p.hold && (p.hold.status === "on_hold" || p.hold.status === "settle_failed"));
    if (s.status === "settling" && !pending) s.status = "ended";
    if (s.status === "settling" || s.status === "ended") {
      const receiptId = s.receiptId ?? newId();
      s.receiptId = receiptId;
      saveReceipt(buildReceipt(s, receiptId, results));
    }
    return results;
  });
}

function collect(s: Session): SettleResult[] {
  const out: SettleResult[] = [];
  for (const p of Object.values(s.players)) {
    const h = p.hold;
    if (!h) continue;
    if (h.status === "captured") out.push({ playerId: p.id, status: "captured", amountCents: h.capturedCents ?? 0, captureId: h.captureId });
    else if (h.status === "voided") out.push({ playerId: p.id, status: "voided", amountCents: 0 });
    else if (h.status === "settle_failed") {
      out.push(s.settle[p.id] ?? { playerId: p.id, status: "settle_failed", amountCents: 0, error: h.error });
    }
  }
  return out;
}

function buildReceipt(s: Session, id: string, results: SettleResult[]): Receipt {
  return {
    id,
    jarName: s.jar.name,
    mode: s.jar.mode,
    currency: s.jar.currency,
    beneficiaryName: s.jar.beneficiaryName,
    endedAt: s.endedAt ?? Date.now(),
    lines: results.map((r) => ({
      name: s.players[r.playerId].name,
      status: r.status,
      amountCents: r.amountCents,
      captureId: r.captureId,
      // fines of the payer and the players they cover, no quotes or transcript
      fines: s.fines.filter(
        (f) => f.status !== "dropped" && (f.playerId === r.playerId || s.players[f.playerId]?.sponsorId === r.playerId),
      ).length,
    })),
  };
}
