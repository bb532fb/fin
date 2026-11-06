import { describe, expect, it } from "vitest";
import { tradeDurationText } from "@/lib/config/market";
import { buildActionGuide, signalLifetimeText } from "@/lib/guidance/action-guide";
import { rankScanItems } from "@/lib/scanner/rank";
import type { ScanItem } from "@/lib/schemas/scan";
import type { TradeAnalysisResult } from "@/types/analysis";

type TradeKeys = "direction" | "risk" | "entry" | "stopLoss" | "takeProfit" | "riskReward" | "stopBasis" | "targetBasis";

const base: Omit<TradeAnalysisResult, TradeKeys> = {
  id: null,
  symbol: "BTCUSDT",
  timeframe: "15m",
  price: 83_050,
  pricePrecision: 2,
  quantityStep: 0.00001,
  minNotional: 5,
  confidence: 72,
  signalStrength: "STRONG",
  bias: "BULLISH",
  trend: "BULLISH",
  higherTimeframe: "1h",
  higherTrend: "BULLISH",
  setupQuality: "B",
  indicators: { rsi: 58, ema20: 1, ema50: 1, ema200: 1, macd: "BULLISH", macdHistogram: 1, volumeChange: 0, atr: 100 },
  support: null,
  resistance: null,
  recentCandles: [
    { t: 0, o: 83_000, h: 83_100, l: 82_900, c: 83_020 },
    { t: 1, o: 83_020, h: 83_120, l: 82_950, c: 83_050 },
  ],
  priceChangePct: 0.04,
  conditions: [],
  analysis: { summary: "", reasoning: [], riskWarning: "", source: "RULES", model: null },
  engineVersion: "1.1.0",
  candleTime: new Date(0).toISOString(),
  createdAt: new Date(0).toISOString(),
  disclaimer: "",
};

const long: TradeAnalysisResult = {
  ...base,
  direction: "LONG",
  risk: "LOW",
  entry: { min: 83_000, max: 83_060 },
  stopLoss: 82_600,
  takeProfit: 84_200,
  riskReward: 2.4,
  stopBasis: "STRUCTURE",
  targetBasis: "STRUCTURE",
};

describe("buildActionGuide", () => {
  it("gives actionable UP steps for a clean LONG", () => {
    const guide = buildActionGuide(long);
    expect(guide.actionable).toBe(true);
    expect(guide.tone).toBe("long");
    expect(guide.title).toContain("վերև");
    expect(guide.summary).toContain("84,200.00");
    expect(guide.summary).toContain("82,600.00");
    expect(guide.steps.join(" ")).toContain("Take profit");
    expect(guide.steps.join(" ")).toContain("Stop loss");
    expect(guide.steps.join(" ")).toContain("Ժամանակով մի վաճառիր");
  });

  it("refuses HIGH risk trades", () => {
    expect(buildActionGuide({ ...long, risk: "HIGH" }).actionable).toBe(false);
    expect(
      buildActionGuide({
        ...long,
        direction: "SHORT",
        risk: "HIGH",
        entry: { min: 83_000, max: 83_060 },
        stopLoss: 83_500,
        takeProfit: 82_000,
      }).actionable,
    ).toBe(false);
  });

  it("makes SHORT actionable as DOWN", () => {
    const guide = buildActionGuide({
      ...long,
      direction: "SHORT",
      bias: "BEARISH",
      trend: "BEARISH",
      entry: { min: 83_000, max: 83_060 },
      stopLoss: 83_500,
      takeProfit: 82_000,
    });
    expect(guide.actionable).toBe(true);
    expect(guide.title).toContain("ներքև");
    expect(guide.steps.join(" ")).toContain("Take profit");
    expect(guide.summary).toContain("82,000.00");
  });

  it("tells a futures trade the direction and how many minutes to set", () => {
    const guide = buildActionGuide({ ...long, timeframe: "5m" }, "futures");
    expect(guide.actionable).toBe(true);
    expect(guide.title).toBe("Բացիր վերևը 5 րոպեով");
    expect(guide.summary).toContain("Բացիր վերևը 5 րոպեով");

    const down = buildActionGuide(
      {
        ...long,
        timeframe: "15m",
        direction: "SHORT",
        bias: "BEARISH",
        trend: "BEARISH",
        entry: { min: 83_000, max: 83_060 },
        stopLoss: 83_500,
        takeProfit: 82_000,
      },
      "futures",
    );
    expect(down.title).toBe("Բացիր ներքևը 15 րոպեով");
  });

  it("tells a Pocket Option trade UP or DOWN and the minutes, without a stop", () => {
    const guide = buildActionGuide({ ...long, timeframe: "5m" }, "pocket");
    expect(guide.actionable).toBe(true);
    expect(guide.title).toBe("Բացիր վերևը 5 րոպեով");
    expect(guide.summary).toContain("ոչ OTC");
    expect(guide.summary).toContain("Բացիր վերևը 5 րոպեով");
    expect(guide.steps.join(" ")).toContain("Pocket Option");
    expect(guide.steps.join(" ")).toContain("փակվում է");
    expect(guide.steps.join(" ")).not.toContain("Երբ փակել կորուստով");
  });

  it("formats signal lifetime", () => {
    expect(signalLifetimeText("1m")).toBe("24 րոպե");
    expect(signalLifetimeText("15m")).toBe("6 ժամ");
    expect(signalLifetimeText("1d")).toBe("24 օր");
  });
});


describe("tradeDurationText", () => {
  it("matches candle length in minutes", () => {
    expect(tradeDurationText("1m")).toBe("1 րոպե");
    expect(tradeDurationText("3m")).toBe("3 րոպե");
    expect(tradeDurationText("15m")).toBe("15 րոպե");
    expect(tradeDurationText("30m")).toBe("30 րոպե");
    expect(tradeDurationText("1h")).toBe("1 ժամ (60 րոպե)");
    expect(tradeDurationText("1d")).toBe("1 օր (1440 րոպե)");
  });
});

describe("rankScanItems", () => {
  const item = (overrides: Partial<ScanItem>): ScanItem => ({
    symbol: "BTCUSDT",
    direction: "NO_TRADE",
    bias: "NEUTRAL",
    confidence: 50,
    risk: null,
    riskReward: null,
    setupQuality: null,
    higherTrend: null,
    noTradeCode: "WEAK_SIGNAL",
    price: 1,
    pricePrecision: 2,
    ...overrides,
  });

  it("ranks CONSIDER trades first by quality, then confidence, then HIGH risk, then WAIT", () => {
    const ranked = rankScanItems([
      item({ symbol: "ETHUSDT", direction: "SHORT", confidence: 90, risk: "LOW", setupQuality: "A" }),
      item({ symbol: "SOLUSDT", direction: "LONG", confidence: 60, risk: "LOW", setupQuality: "B" }),
      item({ symbol: "XRPUSDT", direction: "LONG", confidence: 80, risk: "HIGH", setupQuality: "B" }),
      item({ symbol: "BNBUSDT", direction: "LONG", confidence: 70, risk: "MEDIUM", setupQuality: "B" }),
      item({ symbol: "BTCUSDT" }),
    ]);
    expect(ranked.map((r) => r.symbol)).toEqual(["ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT", "BTCUSDT"]);
  });
});
