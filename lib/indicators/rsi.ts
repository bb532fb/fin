import { assertLength } from "@/lib/indicators/series";

function toRsi(avgGain: number, avgLoss: number): number {
  if (avgLoss === 0) return avgGain === 0 ? 50 : 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

/** Wilder's RSI. Length: closes.length - period. */
export function rsiSeries(closes: readonly number[], period: number): number[] {
  assertLength(closes, period + 1, `RSI${period}`);
  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i <= period; i++) {
    const change = (closes[i] as number) - (closes[i - 1] as number);
    if (change > 0) avgGain += change;
    else avgLoss -= change;
  }
  avgGain /= period;
  avgLoss /= period;

  const result: number[] = [toRsi(avgGain, avgLoss)];
  for (let i = period + 1; i < closes.length; i++) {
    const change = (closes[i] as number) - (closes[i - 1] as number);
    avgGain = (avgGain * (period - 1) + Math.max(change, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-change, 0)) / period;
    result.push(toRsi(avgGain, avgLoss));
  }
  return result;
}
