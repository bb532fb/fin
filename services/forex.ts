import "server-only";
import { z } from "zod";
import { CANDLE_FETCH_LIMIT, FOREX_SYMBOLS, MIN_REQUIRED_CANDLES } from "@/lib/config/market";
import type { Timeframe } from "@/lib/config/market";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { aggregateCandles } from "@/lib/market/aggregate-candles";
import { TtlCache } from "@/lib/ttl-cache";
import type { Candle, CandleRangeProvider, MarketDataProvider, MarketSnapshot } from "@/types/market";

const TIMEOUT_MS = 8_000;
const SNAPSHOT_TTL_MS = 20_000;

const YAHOO_SYMBOL: Record<(typeof FOREX_SYMBOLS)[number], string> = {
  GBPAUD: "GBPAUD=X",
  EURGBP: "EURGBP=X",
  EURUSD: "EURUSD=X",
  AUDCHF: "AUDCHF=X",
  AUDCAD: "AUDCAD=X",
};

/** Yahoo has no 3m or 4h bars. Those are built from the next smaller native bar. */
const NATIVE: Record<Timeframe, { interval: string; range: string } | null> = {
  "1m": { interval: "1m", range: "5d" },
  "3m": null,
  "5m": { interval: "5m", range: "5d" },
  "15m": { interval: "15m", range: "1mo" },
  "30m": { interval: "30m", range: "1mo" },
  "1h": { interval: "1h", range: "6mo" },
  "4h": null,
  "1d": { interval: "1d", range: "5y" },
};

const BASE_OF: Partial<Record<Timeframe, Timeframe>> = { "3m": "1m", "4h": "1h" };

const quoteSchema = z.object({
  open: z.array(z.number().nullable()),
  high: z.array(z.number().nullable()),
  low: z.array(z.number().nullable()),
  close: z.array(z.number().nullable()),
  volume: z.array(z.number().nullable()).nullish(),
});

const chartSchema = z.object({
  chart: z.object({
    result: z
      .array(
        z.object({
          timestamp: z.array(z.number()).nullish(),
          indicators: z.object({ quote: z.array(quoteSchema) }),
        }),
      )
      .nullish(),
  }),
});

const FILTERS = { tickSize: 0.00001, pricePrecision: 5, quantityStep: 1, minNotional: 0 };

function unavailable(cause?: unknown): AppError {
  return new AppError("MARKET_DATA_UNAVAILABLE", "Արտարժույթի տվյալները հասանելի չեն։ Փորձիր մի փոքր ուշ։", {
    cause,
  });
}

function toCandles(raw: z.infer<typeof chartSchema>): Candle[] {
  const row = raw.chart.result?.[0];
  const times = row?.timestamp ?? [];
  const quote = row?.indicators.quote[0];
  if (!quote) throw unavailable();
  const candles: Candle[] = [];
  for (let i = 0; i < times.length; i++) {
    const open = quote.open[i];
    const high = quote.high[i];
    const low = quote.low[i];
    const close = quote.close[i];
    const openTimeSec = times[i];
    if (
      openTimeSec === undefined ||
      open === undefined ||
      high === undefined ||
      low === undefined ||
      close === undefined ||
      open === null ||
      high === null ||
      low === null ||
      close === null ||
      close <= 0 ||
      high < low
    ) {
      continue;
    }
    const openTime = openTimeSec * 1000;
    candles.push({
      openTime,
      closeTime: openTime,
      open,
      high,
      low,
      close,
      volume: quote.volume?.[i] ?? 0,
    });
  }
  return candles;
}

async function fetchChart(yahooSymbol: string, query: Record<string, string>): Promise<Candle[]> {
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}`);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
        headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
      });
      if (!response.ok) {
        logger.warn("forex_http_error", { status: response.status, attempt });
        lastError = unavailable();
        continue;
      }
      const parsed = chartSchema.safeParse(await response.json());
      if (!parsed.success) throw unavailable(parsed.error);
      return toCandles(parsed.data);
    } catch (error) {
      if (error instanceof AppError) throw error;
      lastError = error;
    }
  }
  throw unavailable(lastError);
}

function nativeOf(timeframe: Timeframe): { base: Timeframe; spec: { interval: string; range: string } } {
  const direct = NATIVE[timeframe];
  if (direct) return { base: timeframe, spec: direct };
  const base = BASE_OF[timeframe];
  const spec = base ? NATIVE[base] : null;
  if (!base || !spec) throw unavailable();
  return { base, spec };
}

async function loadCandles(
  symbol: (typeof FOREX_SYMBOLS)[number],
  timeframe: Timeframe,
  bounds?: { startTime: number; endTime: number },
): Promise<Candle[]> {
  const { base, spec } = nativeOf(timeframe);
  const query: Record<string, string> = { interval: spec.interval };
  if (bounds) {
    query.period1 = String(Math.floor(bounds.startTime / 1000));
    query.period2 = String(Math.ceil(bounds.endTime / 1000));
  } else {
    query.range = spec.range;
  }
  const raw = await fetchChart(YAHOO_SYMBOL[symbol], query);
  const candles = base === timeframe ? raw : aggregateCandles(raw, timeframe);
  if (!bounds) return candles.slice(-CANDLE_FETCH_LIMIT);
  return candles.filter((candle) => candle.openTime >= bounds.startTime && candle.openTime <= bounds.endTime);
}

function createForexMarketData(): MarketDataProvider & CandleRangeProvider {
  const snapshots = new TtlCache<MarketSnapshot>(SNAPSHOT_TTL_MS);
  const inflight = new Map<string, Promise<MarketSnapshot>>();

  async function loadSnapshot(symbol: (typeof FOREX_SYMBOLS)[number], timeframe: Timeframe): Promise<MarketSnapshot> {
    const all = await loadCandles(symbol, timeframe);
    const openCandle = all.at(-1);
    const candles = all.slice(0, -1);
    if (!openCandle || candles.length < MIN_REQUIRED_CANDLES) {
      throw new AppError(
        "INSUFFICIENT_DATA",
        `${symbol} ${timeframe}-ի համար բավարար շուկայական պատմություն չկա հուսալի վերլուծության համար։`,
      );
    }
    return { candles, livePrice: openCandle.close, filters: FILTERS };
  }

  function getMarketSnapshot(symbol: (typeof FOREX_SYMBOLS)[number], timeframe: Timeframe): Promise<MarketSnapshot> {
    const key = `${symbol}:${timeframe}`;
    const cached = snapshots.get(key);
    if (cached) return Promise.resolve(cached);
    const pending = inflight.get(key);
    if (pending) return pending;
    const promise = loadSnapshot(symbol, timeframe)
      .then((value) => {
        snapshots.set(key, value);
        return value;
      })
      .finally(() => inflight.delete(key));
    inflight.set(key, promise);
    return promise;
  }

  return {
    getMarketSnapshot: (symbol, timeframe) => {
      if (!(symbol in YAHOO_SYMBOL)) throw unavailable();
      return getMarketSnapshot(symbol as (typeof FOREX_SYMBOLS)[number], timeframe);
    },
    getCandleRange: (symbol, interval, startTime, endTime) => {
      if (!(symbol in YAHOO_SYMBOL)) return Promise.reject(unavailable());
      return loadCandles(symbol as (typeof FOREX_SYMBOLS)[number], interval, { startTime, endTime });
    },
  };
}

export const forexMarketData = createForexMarketData();
