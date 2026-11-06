import "server-only";
import { z } from "zod";
import { CANDLE_FETCH_LIMIT, MIN_REQUIRED_CANDLES } from "@/lib/config/market";
import type { SupportedSymbol, Timeframe } from "@/lib/config/market";
import { getServerEnv } from "@/lib/env";
import { AppError, isAppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { TtlCache } from "@/lib/ttl-cache";
import type {
  Candle,
  CandleRangeProvider,
  MarketDataProvider,
  MarketSnapshot,
  SymbolFilters,
} from "@/types/market";

const REQUEST_TIMEOUT_MS = 8_000;
const MAX_ATTEMPTS = 2;
/** Caps parallel calls so a full alert pass does not trip Binance into 500s and timeouts. */
const MAX_IN_FLIGHT = 4;
const CIRCUIT_FAILURES = 3;
const CIRCUIT_OPEN_MS = 20_000;
/** Reuse a snapshot inside one alert pass. 1m and 3m share the same 15m trend. */
const SNAPSHOT_TTL_MS = 20_000;
const FILTERS_TTL_MS = 60 * 60 * 1000;
/** Binance caps one klines request at 1000 rows; callers keep ranges within that. */
const MAX_RANGE_CANDLES = 1_000;

const klineSchema = z.tuple(
  [z.number(), z.string(), z.string(), z.string(), z.string(), z.string(), z.number()],
  z.unknown(),
);
const klinesResponseSchema = z.array(klineSchema);

const exchangeInfoSchema = z.object({
  symbols: z.array(
    z.object({
      symbol: z.string(),
      status: z.string(),
      contractType: z.string().optional(),
      filters: z.array(
        z.object({
          filterType: z.string(),
          tickSize: z.string().optional(),
          stepSize: z.string().optional(),
          minNotional: z.string().optional(),
          notional: z.string().optional(),
        }),
      ),
    }),
  ),
});

interface BinanceSource {
  baseUrl: () => string;
  klinesPath: string;
  exchangeInfoPath: string;
  /** USDT-M lists dated contracts next to the perpetual. Use the perpetual. */
  perpetualOnly: boolean;
}

function unavailable(message: string, cause?: unknown, retryAfterSeconds?: number): AppError {
  return new AppError("MARKET_DATA_UNAVAILABLE", message, { cause, retryAfterSeconds });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Queues work so only `limit` calls run at once. */
function createGate(limit: number) {
  let active = 0;
  const waiting: Array<() => void> = [];
  return function gate<T>(run: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const start = () => {
        active += 1;
        run().then(resolve, reject).finally(() => {
          active -= 1;
          waiting.shift()?.();
        });
      };
      if (active < limit) start();
      else waiting.push(start);
    });
  };
}

function parsePositive(value: string, field: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw unavailable(`Շուկայի տվյալներում սխալ ${field} արժեք կա։`);
  }
  return parsed;
}

function toCandle(row: z.infer<typeof klineSchema>): Candle {
  const [openTime, open, high, low, close, volume, closeTime] = row;
  const candle: Candle = {
    openTime,
    closeTime,
    open: parsePositive(open, "open"),
    high: parsePositive(high, "high"),
    low: parsePositive(low, "low"),
    close: parsePositive(close, "close"),
    volume: parsePositive(volume, "volume"),
  };
  if (candle.high < candle.low || candle.close <= 0) {
    throw unavailable("Շուկայի candle տվյալը անհամապատասխան է։");
  }
  return candle;
}

function positiveFilterValue(raw: string | undefined): number | null {
  const value = raw === undefined ? NaN : Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function precisionFromTickSize(tickSize: string): number {
  const [, decimals = ""] = tickSize.split(".");
  return decimals.replace(/0+$/, "").length;
}

function createBinanceMarketData(source: BinanceSource): MarketDataProvider & CandleRangeProvider {
  const filtersCache = new Map<string, { value: SymbolFilters; expiresAt: number }>();
  const snapshots = new TtlCache<MarketSnapshot>(SNAPSHOT_TTL_MS);
  const snapshotInflight = new Map<string, Promise<MarketSnapshot>>();
  const gate = createGate(MAX_IN_FLIGHT);
  let consecutiveFailures = 0;
  let circuitOpenUntil = 0;

  function noteFailure(): void {
    consecutiveFailures += 1;
    if (consecutiveFailures >= CIRCUIT_FAILURES) {
      circuitOpenUntil = Date.now() + CIRCUIT_OPEN_MS;
      consecutiveFailures = 0;
    }
  }

  function noteSuccess(): void {
    consecutiveFailures = 0;
    circuitOpenUntil = 0;
  }

  async function requestJson(path: string, attempt = 1): Promise<unknown> {
    if (Date.now() < circuitOpenUntil) {
      throw unavailable("Շուկայի տվյալները հասանելի չեն։ Փորձիր մի փոքր ուշ։");
    }
    const url = new URL(path, source.baseUrl());
    let response: Response;
    try {
      response = await gate(() => {
        if (Date.now() < circuitOpenUntil) {
          throw unavailable("Շուկայի տվյալները հասանելի չեն։ Փորձիր մի փոքր ուշ։");
        }
        return fetch(url, {
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
      });
    } catch (error) {
      if (isAppError(error)) throw error;
      noteFailure();
      if (attempt < MAX_ATTEMPTS && Date.now() >= circuitOpenUntil) {
        await delay(250 * attempt);
        return requestJson(path, attempt + 1);
      }
      throw unavailable("Շուկայի տվյալները հասանելի չեն։ Փորձիր մի փոքր ուշ։", error);
    }

    if (response.ok) {
      noteSuccess();
      return response.json();
    }

    logger.warn("binance_http_error", { status: response.status, path: url.pathname, attempt });
    if (response.status === 429 || response.status === 418) {
      const retryAfter = Number(response.headers.get("retry-after")) || 60;
      circuitOpenUntil = Date.now() + retryAfter * 1000;
      consecutiveFailures = 0;
      throw unavailable("Շուկայի տվյալների սահմանափակում։ Փորձիր ավելի ուշ։", undefined, retryAfter);
    }
    if (response.status === 451 || response.status === 403) {
      throw unavailable("Շուկայի տվյալները այս սերվերի տարածաշրջանից հասանելի չեն։");
    }
    if (response.status >= 500) noteFailure();
    if (response.status >= 500 && attempt < MAX_ATTEMPTS && Date.now() >= circuitOpenUntil) {
      await delay(250 * attempt);
      return requestJson(path, attempt + 1);
    }
    if (response.status < 500) noteFailure();
    throw unavailable("Շուկայի տվյալների սխալ։ Փորձիր մի փոքր ուշ։");
  }

  async function fetchKlines(query: Record<string, string>): Promise<Candle[]> {
    const raw = await requestJson(`${source.klinesPath}?${new URLSearchParams(query).toString()}`);
    const parsed = klinesResponseSchema.safeParse(raw);
    if (!parsed.success) throw unavailable("Շուկայի տվյալների անսպասելի ձևաչափ։", parsed.error);

    const candles = parsed.data.map(toCandle);
    for (let i = 1; i < candles.length; i++) {
      const current = candles[i];
      const previous = candles[i - 1];
      if (current && previous && current.openTime <= previous.openTime) {
        throw unavailable("Շուկայի candle-ները սխալ հերթականությամբ են։");
      }
    }
    return candles;
  }

  function fetchCandles(symbol: SupportedSymbol, timeframe: Timeframe): Promise<Candle[]> {
    return fetchKlines({ symbol, interval: timeframe, limit: String(CANDLE_FETCH_LIMIT) });
  }

  async function fetchSymbolFilters(symbol: SupportedSymbol): Promise<SymbolFilters> {
    const cachedEntry = filtersCache.get(symbol);
    if (cachedEntry && cachedEntry.expiresAt > Date.now()) return cachedEntry.value;

    const raw = await requestJson(`${source.exchangeInfoPath}?symbol=${symbol}`);
    const parsed = exchangeInfoSchema.safeParse(raw);
    const matches = parsed.success ? parsed.data.symbols.filter((item) => item.symbol === symbol) : [];
    const info = source.perpetualOnly
      ? (matches.find((item) => item.contractType === "PERPETUAL") ?? matches[0])
      : matches[0];
    if (!info) throw unavailable("Exchange info-ի անսպասելի ձևաչափ։", parsed.error);
    if (info.status !== "TRADING") throw unavailable(`${symbol}-ը հիմա չի առևտրվում։`);

    const byType = (type: string) => info.filters.find((filter) => filter.filterType === type);
    const tickSizeRaw = byType("PRICE_FILTER")?.tickSize;
    const tickSize = positiveFilterValue(tickSizeRaw);
    const quantityStep = positiveFilterValue(byType("LOT_SIZE")?.stepSize);
    if (!tickSizeRaw || tickSize === null || quantityStep === null) {
      throw unavailable("Exchange info-ում բացակայում են գնի կամ քանակի ֆիլտրերը։");
    }
    const notionalFilter = byType("NOTIONAL") ?? byType("MIN_NOTIONAL");
    const minNotionalRaw = notionalFilter?.minNotional ?? notionalFilter?.notional;

    const value: SymbolFilters = {
      tickSize,
      pricePrecision: precisionFromTickSize(tickSizeRaw),
      quantityStep,
      minNotional: positiveFilterValue(minNotionalRaw) ?? 0,
    };
    filtersCache.set(symbol, { value, expiresAt: Date.now() + FILTERS_TTL_MS });
    return value;
  }

  /**
   * Binance always returns the in-progress candle last. It is excluded from indicator
   * calculations and used only as the live price, independent of server clock skew.
   */
  async function loadSnapshot(symbol: SupportedSymbol, timeframe: Timeframe): Promise<MarketSnapshot> {
    const [allCandles, filters] = await Promise.all([
      fetchCandles(symbol, timeframe),
      fetchSymbolFilters(symbol),
    ]);
    const openCandle = allCandles.at(-1);
    const candles = allCandles.slice(0, -1);
    if (!openCandle || candles.length < MIN_REQUIRED_CANDLES) {
      throw new AppError(
        "INSUFFICIENT_DATA",
        `${symbol} ${timeframe}-ի համար բավարար շուկայական պատմություն չկա հուսալի վերլուծության համար։`,
      );
    }
    return { candles, livePrice: openCandle.close, filters };
  }

  function getMarketSnapshot(symbol: SupportedSymbol, timeframe: Timeframe): Promise<MarketSnapshot> {
    const key = `${symbol}:${timeframe}`;
    const cached = snapshots.get(key);
    if (cached) return Promise.resolve(cached);
    const pending = snapshotInflight.get(key);
    if (pending) return pending;
    const promise = loadSnapshot(symbol, timeframe)
      .then((value) => {
        snapshots.set(key, value);
        return value;
      })
      .finally(() => snapshotInflight.delete(key));
    snapshotInflight.set(key, promise);
    return promise;
  }

  function getCandleRange(
    symbol: SupportedSymbol,
    interval: Timeframe,
    startTime: number,
    endTime: number,
  ): Promise<Candle[]> {
    return fetchKlines({
      symbol,
      interval,
      startTime: String(startTime),
      endTime: String(endTime),
      limit: String(MAX_RANGE_CANDLES),
    });
  }

  return { getMarketSnapshot, getCandleRange };
}

/** Spot public market data. Outcome tracking replays signals against this feed. */
export const binanceMarketData = createBinanceMarketData({
  baseUrl: () => getServerEnv().BINANCE_API_BASE_URL,
  klinesPath: "/api/v3/klines",
  exchangeInfoPath: "/api/v3/exchangeInfo",
  perpetualOnly: false,
});

/** USDT-M perpetual public market data. Not stored in spot history. */
export const binanceFuturesMarketData = createBinanceMarketData({
  baseUrl: () => getServerEnv().BINANCE_FUTURES_API_BASE_URL,
  klinesPath: "/fapi/v1/klines",
  exchangeInfoPath: "/fapi/v1/exchangeInfo",
  perpetualOnly: true,
});
