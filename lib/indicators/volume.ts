import { assertLength, average } from "@/lib/indicators/series";
import type { Candle } from "@/types/market";

/** Percent change of the average volume of the last `recent` candles vs the preceding `baseline`. */
export function volumeChangePct(
  candles: readonly Candle[],
  recent: number,
  baseline: number,
): number {
  assertLength(candles, recent + baseline, "VolumeChange");
  const volumes = candles.map((c) => c.volume);
  const recentAvg = average(volumes.slice(-recent));
  const baselineAvg = average(volumes.slice(-(recent + baseline), -recent));
  if (baselineAvg === 0) return 0;
  return (recentAvg / baselineAvg - 1) * 100;
}
