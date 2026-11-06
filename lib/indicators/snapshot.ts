import {
  EMA_TREND_MIN_CANDLES,
  INDICATOR_PERIODS as P,
  LEVELS_CONFIG,
  VOLUME_WINDOW,
} from "@/lib/config/trading";
import { adxSeries } from "@/lib/indicators/adx";
import { atrSeries } from "@/lib/indicators/atr";
import { emaSeries } from "@/lib/indicators/ema";
import { detectRangeBreak, findKeyLevels } from "@/lib/indicators/levels";
import { macdSeries } from "@/lib/indicators/macd";
import { rsiSeries } from "@/lib/indicators/rsi";
import { lastValue, previousValue } from "@/lib/indicators/series";
import { volumeChangePct } from "@/lib/indicators/volume";
import type { Candle } from "@/types/market";
import type { IndicatorSnapshot, MacdSnapshot, Trend } from "@/types/signal";

function computeMacd(closes: readonly number[]): MacdSnapshot {
  const macd = macdSeries(closes, P.macdFast, P.macdSlow, P.macdSignal);
  const line = lastValue(macd.line, "MACD");
  const signal = lastValue(macd.signal, "MACD signal");
  const state = line > signal ? "BULLISH" : line < signal ? "BEARISH" : "NEUTRAL";
  return {
    line,
    signal,
    histogram: lastValue(macd.histogram, "MACD histogram"),
    previousHistogram: previousValue(macd.histogram, "MACD histogram"),
    state,
  };
}

export function determineTrend(
  close: number,
  ema20: number,
  ema50: number,
  ema200: number | null,
): Trend {
  const aboveLongTerm = ema200 === null || close > ema200;
  const belowLongTerm = ema200 === null || close < ema200;
  if (close > ema50 && ema20 > ema50 && aboveLongTerm) return "BULLISH";
  if (close < ema50 && ema20 < ema50 && belowLongTerm) return "BEARISH";
  return "NEUTRAL";
}

/**
 * Computes every indicator from closed candles. Support/resistance are split around
 * the live price because the trade plan is built from the live price.
 */
export function computeIndicatorSnapshot(
  candles: readonly Candle[],
  livePrice: number,
): IndicatorSnapshot {
  const closes = candles.map((c) => c.close);
  const lastCandle = candles.at(-1);
  if (!lastCandle) throw new Error("No candles to analyse");

  const closePrice = lastCandle.close;
  const ema20 = lastValue(emaSeries(closes, P.emaFast), "EMA20");
  const ema50 = lastValue(emaSeries(closes, P.emaSlow), "EMA50");
  const ema200 =
    closes.length >= EMA_TREND_MIN_CANDLES
      ? lastValue(emaSeries(closes, P.emaTrend), "EMA200")
      : null;
  const atr = lastValue(atrSeries(candles, P.atr), "ATR");
  const levels = findKeyLevels(candles, livePrice, {
    lookback: LEVELS_CONFIG.lookback,
    pivotWindow: LEVELS_CONFIG.pivotWindow,
    tolerance: atr * LEVELS_CONFIG.clusterAtrMultiple,
  });

  return {
    closePrice,
    rsi: lastValue(rsiSeries(closes, P.rsi), "RSI"),
    ema20,
    ema50,
    ema200,
    macd: computeMacd(closes),
    atr,
    adx: lastValue(adxSeries(candles, P.adx), "ADX"),
    volumeChangePct: volumeChangePct(candles, VOLUME_WINDOW.recent, VOLUME_WINDOW.baseline),
    lastCandleBullish: lastCandle.close > lastCandle.open,
    supports: levels.supports,
    resistances: levels.resistances,
    ...detectRangeBreak(candles, LEVELS_CONFIG.breakoutLookback),
    trend: determineTrend(closePrice, ema20, ema50, ema200),
  };
}
