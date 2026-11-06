import { trueRange } from "@/lib/indicators/atr";
import { assertLength, wilderSeries } from "@/lib/indicators/series";
import type { Candle } from "@/types/market";

function directionalIndex(plusDm: number, minusDm: number, range: number): number {
  if (range === 0) return 0;
  const plusDi = plusDm / range;
  const minusDi = minusDm / range;
  const sum = plusDi + minusDi;
  return sum === 0 ? 0 : (Math.abs(plusDi - minusDi) / sum) * 100;
}

/**
 * Wilder's Average Directional Index (trend strength, direction-agnostic).
 * Length: candles.length - 2 * period + 1.
 */
export function adxSeries(candles: readonly Candle[], period: number): number[] {
  assertLength(candles, 2 * period, `ADX${period}`);
  const ranges: number[] = [];
  const plusDms: number[] = [];
  const minusDms: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const candle = candles[i] as Candle;
    const previous = candles[i - 1] as Candle;
    const up = candle.high - previous.high;
    const down = previous.low - candle.low;
    plusDms.push(up > down && up > 0 ? up : 0);
    minusDms.push(down > up && down > 0 ? down : 0);
    ranges.push(trueRange(candle, previous.close));
  }

  const atr = wilderSeries(ranges, period);
  const plus = wilderSeries(plusDms, period);
  const minus = wilderSeries(minusDms, period);
  const dx = atr.map((range, i) => directionalIndex(plus[i] as number, minus[i] as number, range));
  return wilderSeries(dx, period);
}
