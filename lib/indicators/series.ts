/**
 * Convention for all indicator series in this folder: outputs are tail-aligned with
 * their input, i.e. the last element of every series corresponds to the last input value.
 */
export function lastValue(series: readonly number[], name: string): number {
  const value = series.at(-1);
  if (value === undefined || !Number.isFinite(value)) {
    throw new Error(`Indicator "${name}" has no valid value`);
  }
  return value;
}

export function previousValue(series: readonly number[], name: string): number {
  const value = series.at(-2);
  if (value === undefined || !Number.isFinite(value)) {
    throw new Error(`Indicator "${name}" has no previous value`);
  }
  return value;
}

export function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  let sum = 0;
  for (const value of values) sum += value;
  return sum / values.length;
}

/** Wilder's smoothing (RMA) seeded with the SMA of the first `period` values. Length: values.length - period + 1. */
export function wilderSeries(values: readonly number[], period: number): number[] {
  assertLength(values, period, `RMA${period}`);
  const result: number[] = [average(values.slice(0, period))];
  for (let i = period; i < values.length; i++) {
    const previous = result[result.length - 1] as number;
    result.push((previous * (period - 1) + (values[i] as number)) / period);
  }
  return result;
}

export function assertLength(values: readonly unknown[], minimum: number, name: string): void {
  if (values.length < minimum) {
    throw new Error(`Indicator "${name}" requires at least ${minimum} values, got ${values.length}`);
  }
}
