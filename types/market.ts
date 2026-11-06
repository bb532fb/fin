import type { SupportedSymbol, Timeframe } from "@/lib/config/market";

export interface Candle {
  openTime: number;
  closeTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface SymbolFilters {
  tickSize: number;
  /** Decimal places implied by tickSize, used for display and rounding. */
  pricePrecision: number;
  /** LOT_SIZE step: order quantities must be a multiple of this. */
  quantityStep: number;
  /** Minimum order value in quote currency (NOTIONAL filter); 0 when the exchange reports none. */
  minNotional: number;
}

export interface MarketSnapshot {
  /** Closed candles only, oldest first. */
  candles: Candle[];
  /** Latest traded price (close of the still-open candle). */
  livePrice: number;
  filters: SymbolFilters;
}

/** Abstraction so Binance REST can later be swapped for WebSocket or another exchange. */
export interface MarketDataProvider {
  getMarketSnapshot(symbol: SupportedSymbol, timeframe: Timeframe): Promise<MarketSnapshot>;
}

/** Candles (including the in-progress one) whose open time lies in [startTime, endTime]. */
export interface CandleRangeProvider {
  getCandleRange(
    symbol: SupportedSymbol,
    interval: Timeframe,
    startTime: number,
    endTime: number,
  ): Promise<Candle[]>;
}
