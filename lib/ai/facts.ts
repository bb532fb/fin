import { timeframeMinutes, type SupportedSymbol, type Timeframe } from "@/lib/config/market";
import type { SymbolFilters } from "@/types/market";
import type { EngineResult, SetupQuality, Trend } from "@/types/signal";

/** The only data the AI ever sees: already-computed, rounded values. Never raw candles. */
export interface AnalysisFacts {
  symbol: SupportedSymbol;
  timeframe: Timeframe;
  /** Recommended trade duration in minutes (matches the analysed candle length). */
  recommendedTradeMinutes: number;
  currentPrice: number;
  direction: EngineResult["direction"];
  bias: EngineResult["bias"];
  confidence: number;
  signalStrength: EngineResult["signalStrength"];
  trend: EngineResult["indicators"]["trend"];
  higherTimeframe: Timeframe | null;
  higherTrend: Trend | null;
  setupQuality: SetupQuality | null;
  risk: string | null;
  indicators: {
    rsi: number;
    ema20: number;
    ema50: number;
    ema200: number | null;
    macd: string;
    macdHistogram: number;
    volumeChangePct: number;
    atr: number;
  };
  support: number | null;
  resistance: number | null;
  entry: { min: number; max: number } | null;
  stopLoss: number | null;
  takeProfit: number | null;
  riskReward: number | null;
  metConditions: string[];
  noTradeReason: string | null;
}

export function buildAnalysisFacts(
  result: EngineResult,
  context: {
    symbol: SupportedSymbol;
    timeframe: Timeframe;
    livePrice: number;
    filters: SymbolFilters;
    higherTimeframe: Timeframe | null;
    higherTrend: Trend | null;
  },
): AnalysisFacts {
  const { indicators: ind } = result;
  const price = (value: number) => Number(value.toFixed(context.filters.pricePrecision));
  const trade = result.direction === "NO_TRADE" ? null : result;

  return {
    symbol: context.symbol,
    timeframe: context.timeframe,
    recommendedTradeMinutes: timeframeMinutes(context.timeframe),
    currentPrice: price(context.livePrice),
    direction: result.direction,
    bias: result.bias,
    confidence: result.confidence,
    signalStrength: result.signalStrength,
    trend: ind.trend,
    higherTimeframe: context.higherTimeframe,
    higherTrend: context.higherTrend,
    setupQuality: trade?.setupQuality ?? null,
    risk: trade?.risk ?? null,
    indicators: {
      rsi: Number(ind.rsi.toFixed(1)),
      ema20: price(ind.ema20),
      ema50: price(ind.ema50),
      ema200: ind.ema200 === null ? null : price(ind.ema200),
      macd: ind.macd.state,
      macdHistogram: Number(ind.macd.histogram.toPrecision(4)),
      volumeChangePct: Number(ind.volumeChangePct.toFixed(1)),
      atr: price(ind.atr),
    },
    support: ind.supports[0] === undefined ? null : price(ind.supports[0]),
    resistance: ind.resistances[0] === undefined ? null : price(ind.resistances[0]),
    entry: trade ? { min: trade.plan.entryMin, max: trade.plan.entryMax } : null,
    stopLoss: trade?.plan.stopLoss ?? null,
    takeProfit: trade?.plan.takeProfit ?? null,
    riskReward: trade?.plan.riskReward ?? null,
    metConditions: result.conditions.filter((c) => c.met).map((c) => `${c.side}: ${c.label}`),
    noTradeReason: result.direction === "NO_TRADE" ? result.noTrade.message : null,
  };
}
