import { MARKETS, POCKET_SYMBOLS } from "@/lib/config/market";
import type { MarketVenue } from "@/lib/config/market";

/** What the Telegram bot watches until the user changes it on the site. */
export const DEFAULT_ALERT_VENUES: readonly MarketVenue[] = ["futures", "pocket"];

/** Pocket pairs that stay quiet until the star is cleared. Bitcoin and Ethereum start off. */
export const DEFAULT_MUTED_POCKET: readonly (typeof POCKET_SYMBOLS)[number][] = ["BTCUSDT", "ETHUSDT"];

export type PocketSymbol = (typeof POCKET_SYMBOLS)[number];

/** Keeps only real venues, in Spot → Futures → Pocket order, with no duplicates. */
export function normalizeAlertVenues(input: readonly string[]): MarketVenue[] {
  const chosen = new Set(input);
  return MARKETS.filter((venue) => chosen.has(venue));
}

/** Pocket symbols whose Telegram message is turned off with the star. */
export function normalizeMutedPocket(input: readonly string[]): PocketSymbol[] {
  const chosen = new Set(input);
  return POCKET_SYMBOLS.filter((symbol) => chosen.has(symbol));
}
