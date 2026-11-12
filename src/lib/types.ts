import type { Cents } from "./money";
import type { RuleSet } from "./rules";

export type Mode = "party" | "family";
export type Lang = string; // BCP-47 for Web Speech, e.g. "en-US", "it-IT"
export type AiMode = "groq" | "local" | "custom" | "lexicon";

export type HoldStatus =
  | "none" // no PayPal yet
  | "pending" // order created, waiting for buyer approval
  | "on_hold" // authorization created
  | "captured"
  | "voided"
  | "settle_failed";

export type Hold = {
  orderId: string | null;
  authorizationId: string | null;
  /** Amount authorized: cap, or cap × (1 + sponsored players) for a Family-mode parent. */
  amountCents: Cents;
  status: HoldStatus;
  captureId?: string;
  capturedCents?: Cents;
  voidedAt?: number;
  error?: string;
};

export type Player = {
  id: string;
  name: string;
  lang: Lang;
  isCreator: boolean;
  /** Family mode: the paying player who covers this sponsored player (no PayPal of their own). */
  sponsorId: string | null;
  hold: Hold | null;
  joinedAt: number;
};

export type FineStatus = "active" | "contested" | "dropped";

export type Objection = {
  byPlayerId: string;
  votes: Record<string, "keep" | "drop">;
  deadline: number; // ms epoch; 20 s after the objection
};

export type Fine = {
  id: string;
  playerId: string;
  utteranceIndex: number;
  /** Raw quote. Only ever sent to the speaker themself (see publicView). */
  quote: string;
  masked: string; // e.g. "c***o"
  normalized: string;
  tierId: string;
  /** Final price after multiplier and cap clamp. 0 is allowed when the cap is reached. */
  priceCents: Cents;
  multiplier: number;
  confidence: number;
  reason: string;
  alternative?: string;
  status: FineStatus;
  objection: Objection | null;
  source: "ai" | "lexicon";
  ts: number;
  /** Objection window: players can object until this time (30 s after the fine). */
  objectableUntil: number;
};

export type Jar = {
  code: string; // 6 chars, uppercase
  name: string;
  mode: Mode;
  capCents: Cents;
  currency: string;
  beneficiaryEmail: string | null;
  beneficiaryName: string;
  rulesText: string;
  rules: RuleSet;
  rulesConfirmed: boolean;
  creatorPlayerId: string;
  createdAt: number;
};

export type SessionStatus = "lobby" | "live" | "settling" | "ended";

export type PlayerReport = {
  title: string; // "The Sailor", "Il Diplomatico"
  summary: string;
  mostUsed: string | null; // masked
  alternatives: string[];
};

export type SettleResult = {
  playerId: string; // the payer (authorization holder)
  status: "captured" | "voided" | "settle_failed";
  amountCents: Cents;
  captureId?: string;
  error?: string;
};

export type Session = {
  jar: Jar;
  status: SessionStatus;
  players: Record<string, Player>;
  fines: Fine[];
  /** Next utterance index per player. */
  utteranceCounter: Record<string, number>;
  /** Last 3 finalized utterances per player: in memory only, never snapshotted, never shown. */
  context: Record<string, string[]>;
  activeMultiplierId: string | null;
  aiBusy: boolean; // last judge batch fell back to the lexicon
  startedAt: number | null;
  endedAt: number | null;
  reports: Record<string, PlayerReport>;
  settle: Record<string, SettleResult>;
  receiptId: string | null;
};

/** What clients receive over SSE / GET. No transcripts, quotes masked except the viewer's own. */
export type PublicSession = Omit<Session, "context" | "fines"> & {
  fines: (Omit<Fine, "quote"> & { quote?: string })[];
  aiMode: AiMode;
  aiModel: string | null;
  now: number;
};

export type Receipt = {
  id: string;
  jarName: string;
  mode: Mode;
  currency: string;
  beneficiaryName: string;
  endedAt: number;
  lines: { name: string; status: SettleResult["status"]; amountCents: Cents; captureId?: string; fines: number }[];
};
