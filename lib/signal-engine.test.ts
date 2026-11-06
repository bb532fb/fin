import { describe, expect, it } from "vitest";
import { RISK_RULES, RSI_ZONES, SIGNAL_THRESHOLDS } from "@/lib/config/trading";
import { evaluateMarket } from "@/lib/signal-engine";
import { evaluateConditions } from "@/lib/signal/conditions";
import { scoreSignal } from "@/lib/signal/scoring";
import { candlesFromCloses, sineSeries } from "@/tests/helpers/candles";
import type { EngineResult, IndicatorSnapshot } from "@/types/signal";
import type { MarketSnapshot } from "@/types/market";

const filters = { tickSize: 0.01, pricePrecision: 2, quantityStep: 0.00001, minNotional: 5 };

function market(closes: number[], volume?: (i: number) => number): MarketSnapshot {
  const candles = candlesFromCloses(closes, { wick: 0.4, volume });
  return { candles, livePrice: closes.at(-1) as number, filters };
}

/**
 * Trend with pullbacks so indicators are not degenerate. Indicators are shift-invariant,
 * so `base` only changes volatility relative to price (and therefore trading costs).
 */
function trendSeries(length: number, slope: number, base = 1000): number[] {
  return Array.from(
    { length },
    (_, i) => base + slope * i + 6 * Math.sin((2 * Math.PI * i) / 24),
  );
}

function assertValidTrade(result: EngineResult): void {
  if (result.direction === "NO_TRADE") return;
  const { plan } = result;
  expect(result.confidence).toBeGreaterThanOrEqual(SIGNAL_THRESHOLDS.minConfidence);
  expect(plan.riskReward).toBeGreaterThanOrEqual(RISK_RULES.minRiskReward);
  if (result.direction === "LONG") {
    expect(plan.stopLoss).toBeLessThan(plan.entryMin);
    expect(plan.takeProfit).toBeGreaterThan(plan.entryMax);
    expect(result.indicators.rsi).toBeLessThan(RSI_ZONES.overbought);
    if (plan.stopBasis === "STRUCTURE" && result.indicators.supports[0] !== undefined) {
      expect(plan.stopLoss).toBeLessThan(result.indicators.supports[0]);
    }
  } else {
    expect(plan.stopLoss).toBeGreaterThan(plan.entryMax);
    expect(plan.takeProfit).toBeLessThan(plan.entryMin);
    expect(result.indicators.rsi).toBeGreaterThan(RSI_ZONES.oversold);
    if (plan.stopBasis === "STRUCTURE" && result.indicators.resistances[0] !== undefined) {
      expect(plan.stopLoss).toBeGreaterThan(result.indicators.resistances[0]);
    }
  }
}

describe("RSI zone scoring", () => {
  const snapshot = {
    closePrice: 100,
    rsi: 50,
    ema20: 1,
    ema50: 1,
    ema200: 1,
    macd: { line: 0, signal: 0, histogram: 0, previousHistogram: 0, state: "NEUTRAL" },
    atr: 1,
    adx: 25,
    volumeChangePct: 0,
    lastCandleBullish: true,
    supports: [],
    resistances: [],
    breakout: false,
    breakdown: false,
    trend: "NEUTRAL",
  } satisfies IndicatorSnapshot;

  it("gives RSI 50 to the bull side only", () => {
    const conditions = evaluateConditions(snapshot);
    expect(conditions.find((c) => c.id === "rsi_bull_zone")?.met).toBe(true);
    expect(conditions.find((c) => c.id === "rsi_bear_zone")?.met).toBe(false);
  });
});

describe("evaluateMarket", () => {
  it("never signals SHORT in a clean uptrend", () => {
    for (const length of [300, 350, 400, 450, 499]) {
      const result = evaluateMarket(market(trendSeries(length, 0.8)));
      expect(result.direction).not.toBe("SHORT");
      assertValidTrade(result);
    }
  });

  it("never signals LONG in a clean downtrend", () => {
    for (const length of [300, 350, 400, 450, 499]) {
      const result = evaluateMarket(market(trendSeries(length, -0.8)));
      expect(result.direction).not.toBe("LONG");
      assertValidTrade(result);
    }
  });

  it("returns NO_TRADE in a flat ranging market", () => {
    for (const length of [300, 333, 377, 421, 499]) {
      const result = evaluateMarket(market(sineSeries(length, 1000, 5, 30)));
      expect(result.direction).toBe("NO_TRADE");
    }
  });

  it("refuses to short into an extremely oversold market", () => {
    const result = evaluateMarket(market(trendSeries(499, -0.8)));
    expect(result.indicators.rsi).toBeLessThanOrEqual(RSI_ZONES.oversold);
    expect(result.direction).toBe("NO_TRADE");
    if (result.direction === "NO_TRADE") expect(result.noTrade.code).toBe("OVEREXTENDED");
  });

  it("produces a valid LONG in a moderate uptrend", () => {
    const result = evaluateMarket(market(trendSeries(300, 0.3, 100)));
    expect(result.direction).toBe("LONG");
    assertValidTrade(result);
  });

  it("rejects the same setup when trading costs eat the reward", () => {
    const result = evaluateMarket(market(trendSeries(300, 0.3, 1000)));
    expect(result.direction).toBe("NO_TRADE");
    if (result.direction === "NO_TRADE") expect(result.noTrade.code).toBe("POOR_RISK_REWARD");
  });

  it("rejects trades that oppose the higher timeframe trend", () => {
    const result = evaluateMarket(market(trendSeries(300, 0.3, 100)), { higherTrend: "BEARISH" });
    expect(result.direction).toBe("NO_TRADE");
    if (result.direction === "NO_TRADE") expect(result.noTrade.code).toBe("HTF_CONFLICT");
  });

  it("allows trades when higher timeframe agrees", () => {
    const result = evaluateMarket(market(trendSeries(300, 0.3, 100)), { higherTrend: "BULLISH" });
    expect(result.direction).toBe("LONG");
    if (result.direction === "LONG") expect(result.setupQuality).toBeTruthy();
  });

  it("is deterministic", () => {
    const input = market(trendSeries(499, 0.8));
    expect(evaluateMarket(input)).toEqual(evaluateMarket(input));
  });

  it("omits EMA200 conditions when history is too short", () => {
    const result = evaluateMarket(market(trendSeries(200, 0.8)));
    expect(result.indicators.ema200).toBeNull();
    expect(result.conditions.some((c) => c.id.startsWith("ema50_"))).toBe(false);
  });
});

describe("scoreSignal", () => {
  it("gives 100 when every bullish condition is met and no bearish one", () => {
    const { indicators } = evaluateMarket(market(trendSeries(499, 0.8)));
    const conditions = evaluateConditions(indicators).map((c) => ({ ...c, met: c.side === "BULL" }));
    const scores = scoreSignal(conditions);
    expect(scores).toMatchObject({ bias: "BULLISH", confidence: 100, signalStrength: "VERY_STRONG" });
  });

  it("subtracts half of the opposing score", () => {
    const { indicators } = evaluateMarket(market(trendSeries(499, 0.8)));
    const conditions = evaluateConditions(indicators).map((c) => ({
      ...c,
      met: c.side === "BULL" || c.id === "macd_bearish",
    }));
    expect(scoreSignal(conditions)).toMatchObject({ bullScore: 100, bearScore: 15, confidence: 93 });
  });

  it("returns zero confidence for perfectly balanced conditions", () => {
    const { indicators } = evaluateMarket(market(trendSeries(499, 0.8)));
    const conditions = evaluateConditions(indicators).map((c) => ({ ...c, met: true }));
    expect(scoreSignal(conditions)).toMatchObject({ bias: "NEUTRAL", confidence: 0 });
  });
});
