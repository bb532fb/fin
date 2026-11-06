import "server-only";
import { higherTimeframe } from "@/lib/config/market";
import type { SupportedSymbol, Timeframe } from "@/lib/config/market";
import { computeIndicatorSnapshot } from "@/lib/indicators/snapshot";
import type { MarketDataProvider, MarketSnapshot } from "@/types/market";
import type { Trend } from "@/types/signal";

export interface MarketWithHtf {
  market: MarketSnapshot;
  higherTimeframe: Timeframe | null;
  higherTrend: Trend | null;
}

/** Primary snapshot plus higher-timeframe trend for confirmation filters. */
export async function loadMarketWithHtf(
  marketData: MarketDataProvider,
  symbol: SupportedSymbol,
  timeframe: Timeframe,
): Promise<MarketWithHtf> {
  const htf = higherTimeframe(timeframe);
  const [market, higherMarket] = await Promise.all([
    marketData.getMarketSnapshot(symbol, timeframe),
    htf ? marketData.getMarketSnapshot(symbol, htf) : Promise.resolve(null),
  ]);

  const higherTrend = higherMarket
    ? computeIndicatorSnapshot(higherMarket.candles, higherMarket.livePrice).trend
    : null;

  return { market, higherTimeframe: htf, higherTrend };
}
