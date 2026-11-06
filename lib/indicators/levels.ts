import type { Candle } from "@/types/market";

export interface KeyLevels {
  /** Below the reference price, nearest first. */
  supports: number[];
  /** Above the reference price, nearest first. */
  resistances: number[];
}

/**
 * Swing pivots: a candle whose high (low) is strictly greater (lower) than the `window`
 * candles on each side. The last `window` candles cannot be confirmed and are skipped.
 */
export function findPivots(candles: readonly Candle[], window: number) {
  const highs: number[] = [];
  const lows: number[] = [];
  for (let i = window; i < candles.length - window; i++) {
    const center = candles[i] as Candle;
    let isHigh = true;
    let isLow = true;
    for (let j = i - window; j <= i + window && (isHigh || isLow); j++) {
      if (j === i) continue;
      const other = candles[j] as Candle;
      if (other.high >= center.high) isHigh = false;
      if (other.low <= center.low) isLow = false;
    }
    if (isHigh) highs.push(center.high);
    if (isLow) lows.push(center.low);
  }
  return { highs, lows };
}

/** Merges nearby prices into a single level (mean of the cluster). */
export function clusterLevels(prices: readonly number[], tolerance: number): number[] {
  const sorted = [...prices].sort((a, b) => a - b);
  const clusters: number[][] = [];
  for (const price of sorted) {
    const current = clusters.at(-1);
    const anchor = current?.at(-1);
    if (current && anchor !== undefined && price - anchor <= tolerance) current.push(price);
    else clusters.push([price]);
  }
  return clusters.map((cluster) => cluster.reduce((sum, p) => sum + p, 0) / cluster.length);
}

export function findKeyLevels(
  candles: readonly Candle[],
  referencePrice: number,
  options: { lookback: number; pivotWindow: number; tolerance: number },
): KeyLevels {
  const recent = candles.slice(-options.lookback);
  const { highs, lows } = findPivots(recent, options.pivotWindow);
  const levels = clusterLevels([...highs, ...lows], options.tolerance);

  return {
    supports: levels.filter((level) => level < referencePrice).sort((a, b) => b - a),
    resistances: levels.filter((level) => level > referencePrice).sort((a, b) => a - b),
  };
}

/** Breakout/breakdown of the last closed candle versus the preceding `lookback` range. */
export function detectRangeBreak(candles: readonly Candle[], lookback: number) {
  const last = candles.at(-1);
  const range = candles.slice(-(lookback + 1), -1);
  if (!last || range.length < lookback) return { breakout: false, breakdown: false };

  const rangeHigh = Math.max(...range.map((c) => c.high));
  const rangeLow = Math.min(...range.map((c) => c.low));
  return { breakout: last.close > rangeHigh, breakdown: last.close < rangeLow };
}
