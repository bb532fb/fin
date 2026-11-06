import "server-only";
import { isForexSymbol, MARKETS, SUPPORTED_SYMBOLS, TIMEFRAMES } from "@/lib/config/market";
import type { MarketVenue, SupportedSymbol, Timeframe } from "@/lib/config/market";
import {
  RESOLUTION_TIMEFRAME,
  TRACKER_BATCH_SIZE,
  TRACKER_MIN_INTERVAL_MS,
} from "@/lib/config/tracking";
import { getDb } from "@/lib/db";
import { describeError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { resolveExpiry, resolveOutcome } from "@/lib/tracking/resolve-outcome";
import type { OutcomeUpdate, TrackedSignal } from "@/lib/tracking/resolve-outcome";
import { binanceFuturesMarketData, binanceMarketData } from "@/services/binance";
import { forexMarketData } from "@/services/forex";
import type { CandleRangeProvider } from "@/types/market";

interface PendingRow {
  id: string;
  symbol: SupportedSymbol;
  timeframe: Timeframe;
  market: MarketVenue;
  pricePrecision: number;
  signal: TrackedSignal;
  /** Pocket Option settles against this price when the minutes end. */
  expiryPrice: number | null;
}

const isSymbol = (value: string): value is SupportedSymbol =>
  (SUPPORTED_SYMBOLS as readonly string[]).includes(value);
const isTimeframe = (value: string): value is Timeframe =>
  (TIMEFRAMES as readonly string[]).includes(value);
const isMarket = (value: string): value is MarketVenue =>
  (MARKETS as readonly string[]).includes(value);

async function loadPending(): Promise<PendingRow[]> {
  const rows = await getDb().analysis.findMany({
    where: { status: "PENDING", direction: { in: ["LONG", "SHORT"] } },
    orderBy: { expiresAt: "asc" },
    take: TRACKER_BATCH_SIZE,
  });
  return rows.flatMap((row) => {
    const { entryMin, entryMax, stopLoss, takeProfit, expiresAt } = row;
    if (row.direction === "NO_TRADE" || !isSymbol(row.symbol) || !isTimeframe(row.timeframe)) return [];
    if (!expiresAt) return [];
    const market = isMarket(row.market) ? row.market : "spot";
    if (market !== "pocket" && (!entryMin || !entryMax || !stopLoss || !takeProfit)) return [];
    return [
      {
        id: row.id,
        symbol: row.symbol,
        timeframe: row.timeframe,
        market,
        pricePrecision: row.pricePrecision,
        expiryPrice: market === "pocket" ? Number(row.price) : null,
        signal: {
          direction: row.direction,
          entryMin: Number(entryMin ?? row.price),
          entryMax: Number(entryMax ?? row.price),
          stopLoss: Number(stopLoss ?? row.price),
          takeProfit: Number(takeProfit ?? row.price),
          createdAt: row.createdAt.getTime(),
          expiresAt: expiresAt.getTime(),
        },
      },
    ];
  });
}

async function saveUpdate(row: PendingRow, update: OutcomeUpdate): Promise<void> {
  const entryTriggeredAt = update.entryTriggeredAt === null ? null : new Date(update.entryTriggeredAt);
  const data =
    update.status === "PENDING"
      ? { entryTriggeredAt }
      : {
          status: update.status,
          entryTriggeredAt,
          resolvedAt: new Date(update.resolvedAt),
          priceAtResolution: update.priceAtResolution.toFixed(row.pricePrecision),
        };
  // Guarded by status so a concurrent run can never overwrite a final outcome.
  await getDb().analysis.updateMany({ where: { id: row.id, status: "PENDING" }, data });
}

async function trackOne(
  row: PendingRow,
  sources: { spot: CandleRangeProvider; futures: CandleRangeProvider; forex: CandleRangeProvider },
  now: number,
): Promise<void> {
  const candles = isForexSymbol(row.symbol)
    ? sources.forex
    : row.market === "futures"
      ? sources.futures
      : sources.spot;
  const endTime = Math.min(now, row.signal.expiresAt);
  const range = await candles.getCandleRange(
    row.symbol,
    RESOLUTION_TIMEFRAME[row.timeframe],
    row.signal.createdAt,
    endTime,
  );
  const update =
    row.market === "pocket" && row.expiryPrice !== null
      ? resolveExpiry(
          {
            direction: row.signal.direction,
            price: row.expiryPrice,
            createdAt: row.signal.createdAt,
            expiresAt: row.signal.expiresAt,
          },
          range,
          now,
        )
      : resolveOutcome(row.signal, range, now);
  if (update.status === "PENDING" && update.entryTriggeredAt === null) return;
  await saveUpdate(row, update);
}

export function createOutcomeTracker(sources: {
  spot: CandleRangeProvider;
  futures: CandleRangeProvider;
  forex: CandleRangeProvider;
}) {
  let running: Promise<void> | null = null;
  let lastRunAt = 0;

  async function run(): Promise<void> {
    const now = Date.now();
    const pending = await loadPending();
    const results = await Promise.allSettled(pending.map((row) => trackOne(row, sources, now)));
    results.forEach((result, i) => {
      if (result.status === "rejected") {
        logger.warn("outcome_track_failed", { id: pending[i]?.id, error: describeError(result.reason) });
      }
    });
  }

  /** Best effort: never throws, throttled per instance, and concurrent callers share one run. */
  async function trackPending(): Promise<void> {
    if (running) return running;
    if (Date.now() - lastRunAt < TRACKER_MIN_INTERVAL_MS) return;
    lastRunAt = Date.now();
    running = run()
      .catch((error: unknown) => logger.error("outcome_tracker_failed", { error: describeError(error) }))
      .finally(() => {
        running = null;
      });
    return running;
  }

  return { trackPending };
}

export const outcomeTracker = createOutcomeTracker({
  spot: binanceMarketData,
  futures: binanceFuturesMarketData,
  forex: forexMarketData,
});
