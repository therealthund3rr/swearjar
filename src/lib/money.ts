// Money is integer cents everywhere. Strings like "10.00" exist only at the PayPal boundary.

export type Cents = number;

export function assertCents(c: number): Cents {
  if (!Number.isSafeInteger(c) || c < 0) throw new Error(`Invalid cents amount: ${c}`);
  return c;
}

/** 1050 -> "10.50" (PayPal `amount.value`). */
export function toPayPalValue(c: Cents): string {
  assertCents(c);
  const whole = Math.floor(c / 100);
  const frac = c % 100;
  return `${whole}.${frac.toString().padStart(2, "0")}`;
}

/** "10.50" -> 1050. Parses strings, never floats, so 0.1 + 0.2 issues cannot happen. */
export function fromPayPalValue(v: string): Cents {
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(v.trim());
  if (!m) throw new Error(`Invalid PayPal amount: ${v}`);
  return assertCents(parseInt(m[1], 10) * 100 + parseInt((m[2] ?? "0").padEnd(2, "0"), 10));
}

/** Multiply a price by a (possibly fractional) factor, rounding to the nearest cent. */
export function scaleCents(c: Cents, factor: number): Cents {
  return assertCents(Math.round(c * factor));
}

/** How much of `amount` still fits under `cap` given what is already owed. */
export function clampToCap(amount: Cents, alreadyOwed: Cents, cap: Cents): Cents {
  return Math.max(0, Math.min(amount, cap - alreadyOwed));
}

export function sumCents(values: Cents[]): Cents {
  return values.reduce((a, b) => a + b, 0);
}

/** Display formatting for the UI, e.g. "$10.50" / "€10.50". */
export function formatMoney(c: Cents, currency: string): string {
  const sym = currency === "EUR" ? "€" : currency === "USD" ? "$" : `${currency} `;
  return `${sym}${toPayPalValue(c)}`;
}
