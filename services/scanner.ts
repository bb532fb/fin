import "server-only";
import { isForexSymbol, symbolsFor } from "@/lib/config/market";
import type { MarketVenue, SupportedSymbol, Timeframe } from "@/lib/config/market";
import { AppError, describeError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { loadMarketWithHtf } from "@/lib/market/with-htf";
import { rankScanItems } from "@/lib/scanner/rank";
import type { ScanItem, ScanResult } from "@/lib/schemas/scan";
import { evaluateMarket } from "@/lib/signal-engine";
import { TtlCache } from "@/lib/ttl-cache";
import { binanceFuturesMarketData, binanceMarketData } from "@/services/binance";
import { forexMarketData } from "@/services/forex";
import type { MarketDataProvider } from "@/types/market";

export interface ScanCommand {
  timeframe: Timeframe;
  market?: MarketVenue;
}

const SCAN_CACHE_TTL_MS = 30_000;

async function scanSymbol(
  marketData: MarketDataProvider,
  symbol: SupportedSymbol,
  timeframe: Timeframe,
): Promise<ScanItem> {
  const { market, higherTrend } = await loadMarketWithHtf(marketData, symbol, timeframe);
  const engine = evaluateMarket(market, { higherTrend });
  const trade = engine.direction === "NO_TRADE" ? null : engine;
  const precision = market.filters.pricePrecision;
  return {
    symbol,
    direction: engine.direction,
    bias: engine.bias,
    confidence: engine.confidence,
    risk: trade?.risk ?? null,
    riskReward: trade?.plan.riskReward ?? null,
    setupQuality: trade?.setupQuality ?? null,
    higherTrend,
    noTradeCode: engine.direction === "NO_TRADE" ? engine.noTrade.code : null,
    price: Number(market.livePrice.toFixed(precision)),
    pricePrecision: precision,
  };
}

/**
 * Engine-only pass over all pairs: no AI call and nothing persisted.
 * Opening a spot pair runs the full analysis, so that signal is stored and tracked.
 * Opening a futures or Pocket Option pair stores that signal with its own outcome rule.
 * Pocket Option crypto uses the real spot book. Forex pairs use the forex book.
 * Pocket Option does not publish its OTC prices.
 */
export function createScanner(sources: {
  spot: MarketDataProvider;
  futures: MarketDataProvider;
  forex: MarketDataProvider;
}) {
  const cache = new TtlCache<ScanResult>(SCAN_CACHE_TTL_MS);
  const inFlight = new Map<string, Promise<ScanResult>>();

  async function run(command: ScanCommand): Promise<ScanResult> {
    const venue = command.market ?? "spot";
    const { timeframe } = command;
    const symbols = symbolsFor(venue);
    const settled = await Promise.allSettled(
      symbols.map((symbol) => {
        const marketData = isForexSymbol(symbol)
          ? sources.forex
          : venue === "futures"
            ? sources.futures
            : sources.spot;
        return scanSymbol(marketData, symbol, timeframe);
      }),
    );
    const items: ScanItem[] = [];
    const failed: SupportedSymbol[] = [];
    settled.forEach((outcome, i) => {
      const symbol = symbols[i];
      if (!symbol) return;
      if (outcome.status === "fulfilled") items.push(outcome.value);
      else {
        failed.push(symbol);
        logger.warn("scan_symbol_failed", { symbol, timeframe, error: describeError(outcome.reason) });
      }
    });
    if (items.length === 0) {
      throw new AppError("MARKET_DATA_UNAVAILABLE", "Շուկայի տվյալները հասանելի չեն։ Փորձիր մի փոքր ուշ։");
    }
    return {
      timeframe,
      market: venue,
      createdAt: new Date().toISOString(),
      items: rankScanItems(items),
      failed,
    };
  }

  async function scan(command: ScanCommand): Promise<ScanResult> {
    const key = `${command.market ?? "spot"}:${command.timeframe}`;
    const cached = cache.get(key);
    if (cached) return cached;
    const pending = inFlight.get(key);
    if (pending) return pending;

    const promise = run(command).finally(() => inFlight.delete(key));
    inFlight.set(key, promise);
    const result = await promise;
    if (result.failed.length === 0) cache.set(key, result);
    return result;
  }

  return { scan };
}

export const marketScanner = createScanner({
  spot: binanceMarketData,
  futures: binanceFuturesMarketData,
  forex: forexMarketData,
});
