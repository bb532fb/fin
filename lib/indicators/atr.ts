import { assertLength, wilderSeries } from "@/lib/indicators/series";
import type { Candle } from "@/types/market";

export function trueRange(candle: Candle, previousClose: number): number {
  return Math.max(
    candle.high - candle.low,
    Math.abs(candle.high - previousClose),
    Math.abs(candle.low - previousClose),
  );
}

/** Wilder's Average True Range. Length: candles.length - period. */
export function atrSeries(candles: readonly Candle[], period: number): number[] {
  assertLength(candles, period + 1, `ATR${period}`);
  const ranges: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    ranges.push(trueRange(candles[i] as Candle, (candles[i - 1] as Candle).close));
  }
  return wilderSeries(ranges, period);
}
