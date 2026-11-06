import type { SymbolFilters } from "@/types/market";

type RoundingMode = "nearest" | "down" | "up";

const EPSILON = 1e-9;

/** Rounds to the exchange tick size and strips floating-point noise. */
export function roundToTick(value: number, filters: SymbolFilters, mode: RoundingMode): number {
  const steps = value / filters.tickSize;
  const rounded =
    mode === "down"
      ? Math.floor(steps + EPSILON)
      : mode === "up"
        ? Math.ceil(steps - EPSILON)
        : Math.round(steps);
  return Number((rounded * filters.tickSize).toFixed(filters.pricePrecision));
}

export function floorTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.floor(value * factor + EPSILON) / factor;
}
