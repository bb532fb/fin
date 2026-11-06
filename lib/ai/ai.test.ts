import { describe, expect, it } from "vitest";
import { buildRuleBasedExplanation } from "@/lib/ai/fallback";
import type { AnalysisFacts } from "@/lib/ai/facts";
import { checkExplanation } from "@/lib/ai/guardrails";

const facts: AnalysisFacts = {
  symbol: "BTCUSDT",
  timeframe: "15m",
  recommendedTradeMinutes: 15,
  currentPrice: 63250.5,
  direction: "LONG",
  bias: "BULLISH",
  confidence: 73,
  signalStrength: "STRONG",
  trend: "BULLISH",
  higherTimeframe: "1h",
  higherTrend: "BULLISH",
  setupQuality: "B",
  risk: "MEDIUM",
  indicators: {
    rsi: 61.2,
    ema20: 63100.12,
    ema50: 62600.4,
    ema200: 61000,
    macd: "BULLISH",
    macdHistogram: 12.5,
    volumeChangePct: 14.3,
    atr: 180.25,
  },
  support: 62700,
  resistance: 64700,
  entry: { min: 63196.43, max: 63250.5 },
  stopLoss: 62609.87,
  takeProfit: 64681.97,
  riskReward: 2.23,
  metConditions: ["BULL: EMA20 above EMA50", "BULL: MACD line above signal line"],
  noTradeReason: null,
};

const valid = {
  summary: "Bullish alignment on BTC/USDT 15m with signal confidence 73/100.",
  reasoning: ["EMA20 at 63,100.12 is above EMA50.", "RSI 61.2 sits in the bullish zone (50-70)."],
  riskWarning: "A close below 62609.87 would invalidate the setup.",
};

describe("checkExplanation", () => {
  it("accepts text that only uses provided numbers", () => {
    expect(checkExplanation(valid, facts)).toEqual({ ok: true });
  });

  it("rejects invented prices", () => {
    const result = checkExplanation({ ...valid, summary: "Price may reach 70000 soon." }, facts);
    expect(result.ok).toBe(false);
  });

  it.each([
    "This is a guaranteed profit.",
    "The signal is 100% accurate.",
    "A risk-free entry.",
    "You will make money on this trade.",
    "Price will definitely rise.",
  ])("rejects forbidden phrase: %s", (summary) => {
    expect(checkExplanation({ ...valid, summary }, facts).ok).toBe(false);
  });

  it("allows honest disclaimers", () => {
    const riskWarning = "Past signals do not guarantee future results; trading involves risk.";
    expect(checkExplanation({ ...valid, riskWarning }, facts)).toEqual({ ok: true });
  });
});

describe("buildRuleBasedExplanation", () => {
  it("passes its own guardrails for trades and NO_TRADE", () => {
    const noTrade: AnalysisFacts = {
      ...facts,
      direction: "NO_TRADE",
      risk: null,
      entry: null,
      stopLoss: null,
      takeProfit: null,
      riskReward: null,
      noTradeReason: "Bullish and bearish conditions are too balanced.",
    };
    for (const input of [facts, noTrade]) {
      const explanation = buildRuleBasedExplanation(input);
      expect(explanation.source).toBe("RULES");
      expect(checkExplanation(explanation, input)).toEqual({ ok: true });
    }
  });
});
