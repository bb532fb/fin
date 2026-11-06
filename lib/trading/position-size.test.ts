import { describe, expect, it } from "vitest";
import { sizePosition } from "@/lib/trading/position-size";
import type { PositionInput } from "@/lib/trading/position-size";

const base: PositionInput = {
  capital: 500,
  riskPct: 1,
  entry: 83_000,
  stopLoss: 82_600,
  takeProfit: 84_200,
  quantityStep: 0.00001,
  minNotional: 5,
  feeRate: 0.001,
};

describe("sizePosition", () => {
  it("never risks more than the chosen percentage, fees included", () => {
    const size = sizePosition({ ...base, stopLoss: 81_000 });
    expect(size).not.toBeNull();
    // loss per BTC = 2000 + 0.001 * 164000 = 2164 -> 5 / 2164 = 0.00231 BTC
    expect(size?.quantityText).toBe("0.00231");
    expect(size?.maxLoss).toBeLessThanOrEqual(5);
    expect(size?.maxLoss).toBeGreaterThan(4.99);
    expect(size?.cappedByCapital).toBe(false);
    expect(size?.belowMinNotional).toBe(false);
  });

  it("caps the position at available capital (spot has no leverage)", () => {
    const size = sizePosition(base);
    expect(size?.cappedByCapital).toBe(true);
    expect((size?.notional ?? Infinity) * 1.001).toBeLessThanOrEqual(500);
  });

  it("floors to coarse quantity steps", () => {
    const size = sizePosition({ ...base, entry: 2.5, stopLoss: 2.4, takeProfit: 2.8, quantityStep: 0.1 });
    expect(size?.quantityText).toMatch(/^\d+\.\d$/);
    expect(size?.maxLoss).toBeLessThanOrEqual(5);
  });

  it("flags orders below the exchange minimum", () => {
    const size = sizePosition({ ...base, capital: 5 });
    expect(size?.belowMinNotional).toBe(true);
  });

  it("subtracts fees from potential profit", () => {
    const size = sizePosition(base);
    const gross = (size?.quantity ?? 0) * 1_200;
    expect(size?.potentialProfit).toBeLessThan(gross);
  });

  it("rejects non-positive input", () => {
    expect(sizePosition({ ...base, capital: 0 })).toBeNull();
    expect(sizePosition({ ...base, riskPct: -1 })).toBeNull();
  });
});
