import type { Explanation } from "@/lib/ai/explanation-schema";
import type { SupportedSymbol, Timeframe } from "@/lib/config/market";
import { DISCLAIMER, ENGINE_VERSION } from "@/lib/config/trading";
import type { AnalysisResult } from "@/types/analysis";
import type { MarketSnapshot } from "@/types/market";
import type { EngineResult, Trend } from "@/types/signal";

/** Candles shipped to the client for the mini chart (keeps payload small). */
const CHART_CANDLE_COUNT = 48;

interface BuildContext {
  symbol: SupportedSymbol;
  timeframe: Timeframe;
  market: MarketSnapshot;
  higherTimeframe: Timeframe | null;
  higherTrend: Trend | null;
  createdAt: Date;
}

function buildRecentCandles(market: MarketSnapshot, precision: number) {
  const round = (value: number) => Number(value.toFixed(precision));
  const slice = market.candles.slice(-CHART_CANDLE_COUNT);
  return slice.map((candle) => ({
    t: candle.openTime,
    o: round(candle.open),
    h: round(candle.high),
    l: round(candle.low),
    c: round(candle.close),
  }));
}

/** Maps the internal engine output to the public API contract (validated by the caller). */
export function buildAnalysisResult(
  engine: EngineResult,
  explanation: Explanation,
  { symbol, timeframe, market, higherTimeframe, higherTrend, createdAt }: BuildContext,
): AnalysisResult {
  const { indicators: ind } = engine;
  const precision = market.filters.pricePrecision;
  const round = (value: number) => Number(value.toFixed(precision));
  const lastCandle = market.candles.at(-1);
  if (!lastCandle) throw new Error("Cannot build a result without candles");

  const recentCandles = buildRecentCandles(market, precision);
  const firstClose = recentCandles[0]!.c;
  const lastClose = recentCandles.at(-1)!.c;
  const priceChangePct = Number((((lastClose - firstClose) / firstClose) * 100).toFixed(2));

  const base = {
    id: null,
    symbol,
    timeframe,
    price: round(market.livePrice),
    pricePrecision: precision,
    quantityStep: market.filters.quantityStep,
    minNotional: market.filters.minNotional,
    confidence: engine.confidence,
    signalStrength: engine.signalStrength,
    bias: engine.bias,
    trend: ind.trend,
    higherTimeframe,
    higherTrend,
    indicators: {
      rsi: Number(ind.rsi.toFixed(2)),
      ema20: round(ind.ema20),
      ema50: round(ind.ema50),
      ema200: ind.ema200 === null ? null : round(ind.ema200),
      macd: ind.macd.state,
      macdHistogram: Number(ind.macd.histogram.toPrecision(6)),
      volumeChange: Number(ind.volumeChangePct.toFixed(2)),
      atr: round(ind.atr),
    },
    support: ind.supports[0] === undefined ? null : round(ind.supports[0]),
    resistance: ind.resistances[0] === undefined ? null : round(ind.resistances[0]),
    recentCandles,
    priceChangePct,
    conditions: engine.conditions,
    analysis: explanation,
    engineVersion: ENGINE_VERSION,
    candleTime: new Date(lastCandle.openTime).toISOString(),
    createdAt: createdAt.toISOString(),
    disclaimer: DISCLAIMER,
  };

  if (engine.direction === "NO_TRADE") {
    return { ...base, direction: "NO_TRADE", setupQuality: null, noTrade: engine.noTrade };
  }
  const { plan } = engine;
  return {
    ...base,
    direction: engine.direction,
    setupQuality: engine.setupQuality,
    risk: engine.risk,
    entry: { min: plan.entryMin, max: plan.entryMax },
    stopLoss: plan.stopLoss,
    takeProfit: plan.takeProfit,
    riskReward: plan.riskReward,
    stopBasis: plan.stopBasis,
    targetBasis: plan.targetBasis,
  };
}
