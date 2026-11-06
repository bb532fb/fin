import type { Candle } from "@/types/market";

const STEP_MS = 60_000;

/** Builds candles from close prices. Each candle opens at the previous close. */
export function candlesFromCloses(
  closes: readonly number[],
  options: { wick?: number; volume?: number | ((index: number) => number) } = {},
): Candle[] {
  const wick = options.wick ?? 0.5;
  return closes.map((close, i) => {
    const open = i === 0 ? close : (closes[i - 1] as number);
    const volume =
      typeof options.volume === "function" ? options.volume(i) : (options.volume ?? 100);
    return {
      openTime: i * STEP_MS,
      closeTime: (i + 1) * STEP_MS - 1,
      open,
      high: Math.max(open, close) + wick,
      low: Math.min(open, close) - wick,
      close,
      volume,
    };
  });
}

export function linearSeries(length: number, start: number, step: number): number[] {
  return Array.from({ length }, (_, i) => start + i * step);
}

/** Deterministic oscillation around a center, used for ranging markets. */
export function sineSeries(length: number, center: number, amplitude: number, period: number) {
  return Array.from({ length }, (_, i) => center + amplitude * Math.sin((2 * Math.PI * i) / period));
}
