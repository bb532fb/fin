import { TIMEFRAME_MS } from "@/lib/config/market";
import type { Timeframe } from "@/lib/config/market";
import type { Candle } from "@/types/market";

/** Groups candles into larger bars. The last bar may still be in progress. */
export function aggregateCandles(candles: readonly Candle[], timeframe: Timeframe): Candle[] {
  const bucketMs = TIMEFRAME_MS[timeframe];
  const buckets = new Map<number, Candle>();
  for (const candle of candles) {
    const openTime = Math.floor(candle.openTime / bucketMs) * bucketMs;
    const existing = buckets.get(openTime);
    if (!existing) {
      buckets.set(openTime, {
        ...candle,
        openTime,
        closeTime: openTime + bucketMs - 1,
      });
      continue;
    }
    existing.high = Math.max(existing.high, candle.high);
    existing.low = Math.min(existing.low, candle.low);
    existing.close = candle.close;
    existing.volume += candle.volume;
    existing.closeTime = candle.closeTime;
  }
  return [...buckets.values()].sort((a, b) => a.openTime - b.openTime);
}
