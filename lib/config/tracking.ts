import type { Timeframe } from "@/lib/config/market";

/**
 * Finer candles used to replay a signal's lifetime. Each keeps a full expiry window
 * (SIGNAL_EXPIRY_CANDLES of the analysed timeframe) within one 1000-candle Binance request.
 */
export const RESOLUTION_TIMEFRAME: Record<Timeframe, Timeframe> = {
  "1m": "1m",
  "3m": "1m",
  "5m": "1m",
  "15m": "1m",
  "30m": "5m",
  "1h": "5m",
  "4h": "15m",
  "1d": "1h",
};

/** Pending signals checked per tracker run (bounds Binance calls and page latency). */
export const TRACKER_BATCH_SIZE = 10;

/** Minimum pause between tracker runs within one server instance. */
export const TRACKER_MIN_INTERVAL_MS = 60_000;

/** Closed signals needed before the win rate is treated as meaningful. */
export const MIN_SIGNALS_FOR_STATS = 30;
