import type { Cents } from "@/lib/money";
import type { Fine, Player, PublicSession } from "@/lib/types";

export const LANGS: { value: string; label: string }[] = [
  { value: "en-US", label: "English (en-US)" },
  { value: "it-IT", label: "Italiano (it-IT)" },
  { value: "es-ES", label: "Español (es-ES)" },
  { value: "fr-FR", label: "Français (fr-FR)" },
  { value: "de-DE", label: "Deutsch (de-DE)" },
];

export function defaultLang(): string {
  try {
    const l = navigator.language || "en-US";
    return LANGS.find((x) => x.value.toLowerCase() === l.toLowerCase())?.value ?? LANGS.find((x) => x.value.startsWith(l.slice(0, 2)))?.value ?? "en-US";
  } catch {
    return "en-US";
  }
}

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
      return "Pending";
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
