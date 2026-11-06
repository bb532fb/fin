import { describe, expect, it } from "vitest";
import { formatSymbolPair } from "@/lib/config/market";
import { aggregateCandles } from "@/lib/market/aggregate-candles";
import type { Candle } from "@/types/market";

function minute(index: number, close: number): Candle {
  const openTime = index * 60_000;
  return { openTime, closeTime: openTime + 59_999, open: close, high: close + 1, low: close - 1, close, volume: 1 };
}

describe("aggregateCandles", () => {
  it("builds one 3-minute bar from three 1-minute bars", () => {
    const [bar] = aggregateCandles([minute(0, 10), minute(1, 12), minute(2, 11)], "3m");
    expect(bar).toMatchObject({ openTime: 0, open: 10, high: 13, low: 9, close: 11, volume: 3 });
  });
});

describe("formatSymbolPair", () => {
  it("prints Pocket Option forex the way the platform lists it", () => {
    expect(formatSymbolPair("GBPAUD")).toBe("GBP/AUD");
    expect(formatSymbolPair("EURGBP")).toBe("EUR/GBP");
    expect(formatSymbolPair("EURUSD")).toBe("EUR/USD");
    expect(formatSymbolPair("AUDCHF")).toBe("AUD/CHF");
    expect(formatSymbolPair("AUDCAD")).toBe("AUD/CAD");
    expect(formatSymbolPair("BNBUSDT")).toBe("BNB/USDT");
  });
});
