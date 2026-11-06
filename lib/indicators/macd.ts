import { emaSeries } from "@/lib/indicators/ema";
import { assertLength } from "@/lib/indicators/series";

export interface MacdSeries {
  line: number[];
  signal: number[];
  histogram: number[];
}

/** Standard MACD. All three output series are tail-aligned with each other and with the input. */
export function macdSeries(
  closes: readonly number[],
  fastPeriod: number,
  slowPeriod: number,
  signalPeriod: number,
): MacdSeries {
  assertLength(closes, slowPeriod + signalPeriod, "MACD");
  const fast = emaSeries(closes, fastPeriod);
  const slow = emaSeries(closes, slowPeriod);
  const offset = fast.length - slow.length;
  const line = slow.map((slowValue, i) => (fast[i + offset] as number) - slowValue);

  const signal = emaSeries(line, signalPeriod);
  const lineTail = line.slice(line.length - signal.length);
  const histogram = signal.map((signalValue, i) => (lineTail[i] as number) - signalValue);

  return { line: lineTail, signal, histogram };
}
