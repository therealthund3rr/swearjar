import type { Cents } from "@/lib/money";
import type { Fine, Player, PublicSession } from "@/lib/types";

/** Speech language: English only. */
export const SPEECH_LANG = "en-US";

type AnyFine = Pick<Fine, "playerId" | "status" | "priceCents">;

/** Active + contested fines count; clamped to the cap (same rule as the server). */
export function owedBy(playerId: string, fines: AnyFine[], capCents: Cents): Cents {
  const sum = fines.filter((f) => f.playerId === playerId && f.status !== "dropped").reduce((a, f) => a + f.priceCents, 0);
  return Math.min(sum, capCents);
}

export function sponsoredOf(session: PublicSession, payerId: string): Player[] {
  return Object.values(session.players).filter((p) => p.sponsorId === payerId);
}

/** Hold amount for a payer: cap, or cap x (1 + sponsored players) in family mode. */
export function holdAmount(session: PublicSession, payerId: string): Cents {
  return session.jar.capCents * (1 + sponsoredOf(session, payerId).length);
}

const TIER_COLOURS: Record<string, string> = {
  mild: "var(--coin-mild)",
  strong: "var(--coin-strong)",
  blasphemy: "var(--coin-blasphemy)",
  slur: "var(--coin-slur)",
};
export function tierColour(tierId: string): string {
  return TIER_COLOURS[tierId] ?? "var(--coin-other)";
}

export function holdLabel(status: string | undefined): string {
  switch (status) {
    case "on_hold":
      return "On hold";
    case "pending":
      return "Waiting for approval";
    case "captured":
      return "Captured";
    case "voided":
      return "Voided";
    case "settle_failed":
      return "Settle failed";
    default:
      return "No hold yet";
  }
}
