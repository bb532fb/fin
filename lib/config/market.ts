export const CRYPTO_SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT"] as const;

/** Pocket Option non-OTC forex. These are not Binance pairs. */
export const FOREX_SYMBOLS = ["GBPAUD", "EURGBP", "EURUSD", "AUDCHF", "AUDCAD"] as const;

export const SUPPORTED_SYMBOLS = [...CRYPTO_SYMBOLS, ...FOREX_SYMBOLS] as const;

/** Non-OTC names on Pocket Option. Solana, BNB and XRP are not listed there. */
export const POCKET_SYMBOLS = ["BTCUSDT", "ETHUSDT", ...FOREX_SYMBOLS] as const;

export const MARKETS = ["spot", "futures", "pocket"] as const;

/** Pocket Option book. OTC quotes exist only on their platform, so analysis runs on `market` only. */
export const POCKET_BOOKS = ["market", "otc"] as const;

/** Every chart the engine and API can read. Spot and futures each show a subset. */
export const TIMEFRAMES = ["1m", "3m", "5m", "15m", "30m", "1h", "4h", "1d"] as const;

/** Spot charts. Unchanged from the original product. */
export const SPOT_TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h", "1d"] as const;

/** Short USDT-M charts. The label is the number of minutes the signal tells you to set. */
export const FUTURES_TIMEFRAMES = ["1m", "3m", "5m", "15m", "30m"] as const;

/** Pocket Option expiries. The label is how long the UP/DOWN trade stays open. */
export const POCKET_TIMEFRAMES = ["1m", "3m", "5m", "15m", "30m"] as const;

export type SupportedSymbol = (typeof SUPPORTED_SYMBOLS)[number];
export type Timeframe = (typeof TIMEFRAMES)[number];
export type MarketVenue = (typeof MARKETS)[number];
export type PocketBook = (typeof POCKET_BOOKS)[number];

const MINUTE_MS = 60_000;

export const TIMEFRAME_MS: Record<Timeframe, number> = {
  "1m": MINUTE_MS,
  "3m": 3 * MINUTE_MS,
  "5m": 5 * MINUTE_MS,
  "15m": 15 * MINUTE_MS,
  "30m": 30 * MINUTE_MS,
  "1h": 60 * MINUTE_MS,
  "4h": 240 * MINUTE_MS,
  "1d": 1_440 * MINUTE_MS,
};

/** Candles requested per analysis. 500 gives EMA200 enough warm-up to converge. */
export const CANDLE_FETCH_LIMIT = 500;

/** Below this many closed candles the analysis is refused. */
export const MIN_REQUIRED_CANDLES = 120;

export function isForexSymbol(symbol: string): symbol is (typeof FOREX_SYMBOLS)[number] {
  return (FOREX_SYMBOLS as readonly string[]).includes(symbol);
}

export function formatSymbolPair(symbol: string): string {
  if (isForexSymbol(symbol)) return `${symbol.slice(0, 3)}/${symbol.slice(3)}`;
  return symbol.endsWith("USDT") ? `${symbol.slice(0, -4)}/USDT` : symbol;
}

/** Candle length in minutes — also the recommended trade duration for that timeframe. */
export function timeframeMinutes(timeframe: Timeframe): number {
  return TIMEFRAME_MS[timeframe] / MINUTE_MS;
}

/** The sentence shown for a timed trade: open up or down for this chart's minutes. */
export function openForMinutes(direction: "LONG" | "SHORT", timeframe: Timeframe): string {
  const side = direction === "LONG" ? "վերևը" : "ներքևը";
  return `Բացիր ${side} ${tradeDurationText(timeframe)}ով`;
}

/** Armenian label for how long to set a trade when placing it. */
export function tradeDurationText(timeframe: Timeframe): string {
  const minutes = timeframeMinutes(timeframe);
  if (minutes < 60) return `${minutes} րոպե`;
  const hours = minutes / 60;
  if (hours < 24) return `${hours} ժամ (${minutes} րոպե)`;
  return `${hours / 24} օր (${minutes} րոպե)`;
}

/**
 * Next higher timeframe used for trend confirmation.
 * `1d` has no higher chart in our set — callers skip the HTF filter.
 */
const HIGHER_TIMEFRAME: Record<Timeframe, Timeframe | null> = {
  "1m": "15m",
  "3m": "15m",
  "5m": "1h",
  "15m": "1h",
  "30m": "1h",
  "1h": "4h",
  "4h": "1d",
  "1d": null,
};

export function higherTimeframe(timeframe: Timeframe): Timeframe | null {
  return HIGHER_TIMEFRAME[timeframe];
}

export function symbolsFor(venue: MarketVenue): readonly SupportedSymbol[] {
  return venue === "pocket" ? POCKET_SYMBOLS : CRYPTO_SYMBOLS;
}

/** Keeps the current pair when this venue lists it; otherwise the venue's first pair. */
export function coerceSymbol(venue: MarketVenue, symbol: SupportedSymbol): SupportedSymbol {
  const symbols = symbolsFor(venue);
  return symbols.includes(symbol) ? symbol : (symbols[0] ?? "BTCUSDT");
}

export function timeframesFor(venue: MarketVenue): readonly Timeframe[] {
  if (venue === "spot") return SPOT_TIMEFRAMES;
  if (venue === "futures") return FUTURES_TIMEFRAMES;
  return POCKET_TIMEFRAMES;
}

export function defaultTimeframe(venue: MarketVenue): Timeframe {
  return venue === "spot" ? "15m" : "5m";
}

/** Keeps the current chart when both venues offer it; otherwise picks that venue's default. */
export function coerceTimeframe(venue: MarketVenue, timeframe: Timeframe): Timeframe {
  return timeframesFor(venue).includes(timeframe) ? timeframe : defaultTimeframe(venue);
}

export function timeframeOptionLabel(venue: MarketVenue, timeframe: Timeframe): string {
  if (venue === "spot") return timeframe;
  return `${timeframeMinutes(timeframe)} րոպե`;
}
