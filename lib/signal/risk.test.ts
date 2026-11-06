import { describe, expect, it } from "vitest";
import { roundToTick } from "@/lib/signal/price";
import { assessRiskLevel, buildTradePlan } from "@/lib/signal/risk";
import type { SymbolFilters } from "@/types/market";
import type { IndicatorSnapshot } from "@/types/signal";

const filters: SymbolFilters = { tickSize: 0.01, pricePrecision: 2, quantityStep: 0.00001, minNotional: 5 };

function snapshot(overrides: Partial<IndicatorSnapshot>): IndicatorSnapshot {
  return {
    closePrice: 100,
    rsi: 60,
    ema20: 99,
    ema50: 98,
    ema200: 90,
    macd: { line: 1, signal: 0.5, histogram: 0.5, previousHistogram: 0.4, state: "BULLISH" },
    atr: 2,
    adx: 30,
    volumeChangePct: 0,
    lastCandleBullish: true,
    supports: [],
    resistances: [],
    breakout: false,
    breakdown: false,
    trend: "BULLISH",
    ...overrides,
  };
}

describe("buildTradePlan", () => {
  it("places a LONG stop below support and target below resistance", () => {
    const plan = buildTradePlan({
      direction: "LONG",
      referencePrice: 100,
      snapshot: snapshot({ supports: [95], resistances: [110] }),
      filters,
    });
    expect(plan).toEqual({
      entryMin: 99.4,
      entryMax: 100,
      stopLoss: 94,
      takeProfit: 109.8,
      riskReward: 1.5,
      stopBasis: "STRUCTURE",
      targetBasis: "STRUCTURE",
    });
  });

  it("mirrors the geometry for SHORT", () => {
    const plan = buildTradePlan({
      direction: "SHORT",
      referencePrice: 100,
      snapshot: snapshot({ supports: [90], resistances: [105] }),
      filters,
    });
    expect(plan).toMatchObject({
      entryMin: 100,
      entryMax: 100.6,
      stopLoss: 106,
      takeProfit: 90.2,
      riskReward: 1.5,
    });
  });

  it("falls back to a volatility stop when no support exists", () => {
    const plan = buildTradePlan({
      direction: "LONG",
      referencePrice: 100,
      snapshot: snapshot({ resistances: [110] }),
      filters,
    });
    expect(plan).toMatchObject({ stopLoss: 96, stopBasis: "VOLATILITY", riskReward: 2.2 });
  });

  it("enforces a minimum stop distance of 1 ATR", () => {
    const plan = buildTradePlan({
      direction: "LONG",
      referencePrice: 100,
      snapshot: snapshot({ supports: [99.8], resistances: [110] }),
      filters,
    });
    expect(plan?.stopLoss).toBe(98);
  });

  it("projects a 2R target when no resistance exists", () => {
    const plan = buildTradePlan({
      direction: "LONG",
      referencePrice: 100,
      snapshot: snapshot({ supports: [95] }),
      filters,
    });
    expect(plan).toMatchObject({ takeProfit: 112, targetBasis: "PROJECTED", riskReward: 1.85 });
  });

  it("rejects a plan whose reward does not cover entry and exit costs", () => {
    const plan = buildTradePlan({
      direction: "LONG",
      referencePrice: 100,
      snapshot: snapshot({ atr: 0.05, supports: [99.9], resistances: [100.2] }),
      filters,
    });
    expect(plan).toBeNull();
  });

  it("keeps a structure stop beyond the level", () => {
    const long = buildTradePlan({
      direction: "LONG",
      referencePrice: 100,
      snapshot: snapshot({ supports: [99.2], resistances: [110] }),
      filters,
    });
    expect(long?.stopBasis).toBe("STRUCTURE");
    expect(long?.stopLoss).toBeLessThan(99.2);

    const short = buildTradePlan({
      direction: "SHORT",
      referencePrice: 100,
      snapshot: snapshot({ supports: [90], resistances: [100.8] }),
      filters,
    });
    expect(short?.stopBasis).toBe("STRUCTURE");
    expect(short?.stopLoss).toBeGreaterThan(100.8);
  });

  it("does not call a stop structural when the level is on the wrong side of price", () => {
    const plan = buildTradePlan({
      direction: "LONG",
      referencePrice: 100,
      snapshot: snapshot({ supports: [101], resistances: [110] }),
      filters,
    });
    expect(plan?.stopBasis).toBe("VOLATILITY");
    expect(plan?.stopLoss).toBeLessThan(100);
  });

  it("ignores a support too far away and uses the volatility stop", () => {
    const plan = buildTradePlan({
      direction: "LONG",
      referencePrice: 100,
      snapshot: snapshot({ supports: [80], resistances: [110] }),
      filters,
    });
    expect(plan).toMatchObject({ stopLoss: 96, stopBasis: "VOLATILITY" });
  });
});

describe("assessRiskLevel", () => {
  it("rates a tight, high-confidence structural setup as LOW", () => {
    const plan = {
      entryMin: 99.4, entryMax: 100, stopLoss: 99, takeProfit: 103, riskReward: 3,
      stopBasis: "STRUCTURE" as const, targetBasis: "STRUCTURE" as const,
    };
    expect(assessRiskLevel("LONG", plan, 80, 60)).toBe("LOW");
  });

  it("rates a wide, low-confidence, projected setup as HIGH", () => {
    const plan = {
      entryMin: 99.4, entryMax: 100, stopLoss: 95, takeProfit: 108, riskReward: 1.6,
      stopBasis: "VOLATILITY" as const, targetBasis: "PROJECTED" as const,
    };
    expect(assessRiskLevel("LONG", plan, 60, 72)).toBe("HIGH");
  });
});

describe("roundToTick", () => {
  it("is robust to floating-point error", () => {
    const tenths: SymbolFilters = { tickSize: 0.1, pricePrecision: 1, quantityStep: 0.00001, minNotional: 5 };
    expect(roundToTick(0.3, tenths, "down")).toBe(0.3);
    expect(roundToTick(0.3, tenths, "up")).toBe(0.3);
    expect(roundToTick(0.34, tenths, "up")).toBe(0.4);
    expect(roundToTick(0.0000123456, { tickSize: 0.00000001, pricePrecision: 8, quantityStep: 0.00001, minNotional: 5 }, "nearest")).toBe(
      0.00001235,
    );
  });
});
