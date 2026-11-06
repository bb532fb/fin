import { assertLength, average } from "@/lib/indicators/series";

/** EMA seeded with the SMA of the first `period` values. Length: values.length - period + 1. */
export function emaSeries(values: readonly number[], period: number): number[] {
  assertLength(values, period, `EMA${period}`);
  const multiplier = 2 / (period + 1);
  const result: number[] = [average(values.slice(0, period))];

  for (let i = period; i < values.length; i++) {
    const value = values[i] as number;
    const previous = result[result.length - 1] as number;
    result.push((value - previous) * multiplier + previous);
  }
  return result;
}
