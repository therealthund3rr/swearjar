import { describe, expect, it } from "vitest";
import { clampToCap, formatMoney, fromPayPalValue, scaleCents, toPayPalValue } from "@/lib/money";

describe("money", () => {
  it("formats cents for PayPal", () => {
    expect(toPayPalValue(0)).toBe("0.00");
    expect(toPayPalValue(5)).toBe("0.05");
    expect(toPayPalValue(1050)).toBe("10.50");
  });
  it("parses PayPal values without floats", () => {
    expect(fromPayPalValue("10.5")).toBe(1050);
    expect(fromPayPalValue("0.07")).toBe(7);
    expect(() => fromPayPalValue("1.234")).toThrow();
  });
  it("rejects non-integer cents", () => {
    expect(() => toPayPalValue(1.5)).toThrow();
    expect(() => toPayPalValue(-1)).toThrow();
  });
  it("scales and clamps", () => {
    expect(scaleCents(25, 2)).toBe(50);
    expect(clampToCap(300, 900, 1000)).toBe(100);
    expect(clampToCap(300, 1000, 1000)).toBe(0);
    expect(formatMoney(275, "USD")).toBe("$2.75");
  });
});
