import { describe, expect, it } from "vitest";
import { adxSeries } from "@/lib/indicators/adx";
import { atrSeries } from "@/lib/indicators/atr";
import { emaSeries } from "@/lib/indicators/ema";
import { clusterLevels, detectRangeBreak, findPivots } from "@/lib/indicators/levels";
import { macdSeries } from "@/lib/indicators/macd";
import { rsiSeries } from "@/lib/indicators/rsi";
import { volumeChangePct } from "@/lib/indicators/volume";
import { candlesFromCloses, linearSeries } from "@/tests/helpers/candles";

describe("emaSeries", () => {
  it("seeds with SMA and applies the 2/(n+1) multiplier", () => {
    expect(emaSeries(linearSeries(10, 1, 1), 3)).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("throws when there is not enough data", () => {
    expect(() => emaSeries([1, 2], 3)).toThrow();
  });
});

describe("rsiSeries", () => {
  // Wilder's reference data set (StockCharts RSI tutorial, rounded to 2 decimals).
  // First 14 changes: gains sum 3.34, losses sum 1.40 => RSI = 100 - 100 / (1 + 3.34 / 1.40).
  const closes = [
    44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.1, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61,
    46.28, 46.28, 46.0, 46.03, 46.41, 46.22, 45.64,
  ];

  it("matches the reference values", () => {
    const rsi = rsiSeries(closes, 14);
    expect(rsi).toHaveLength(closes.length - 14);
    expect(rsi[0]).toBeCloseTo(100 - 100 / (1 + 3.34 / 1.4), 8);
    expect(rsi.at(-1)).toBeCloseTo(57.97, 0);
  });

  it("returns 100 for only gains and 50 for a flat market", () => {
    expect(rsiSeries(linearSeries(20, 1, 1), 14).at(-1)).toBe(100);
    expect(rsiSeries(Array(20).fill(10), 14).at(-1)).toBe(50);
  });
});

describe("macdSeries", () => {
  it("is zero for a flat market", () => {
    const macd = macdSeries(Array(100).fill(50), 12, 26, 9);
    expect(macd.line.at(-1)).toBeCloseTo(0, 10);
    expect(macd.histogram.at(-1)).toBeCloseTo(0, 10);
  });

  it("equals the EMA lag difference for a linear trend", () => {
    const macd = macdSeries(linearSeries(200, 100, 1), 12, 26, 9);
    expect(macd.line.at(-1)).toBeCloseTo(7, 8);
    expect(macd.signal.at(-1)).toBeCloseTo(7, 8);
    expect(macd.line).toHaveLength(macd.signal.length);
    expect(macd.histogram).toHaveLength(macd.signal.length);
  });
});

describe("atrSeries", () => {
  it("equals the constant range when there are no gaps", () => {
    const candles = candlesFromCloses(Array(30).fill(100), { wick: 1 });
    expect(atrSeries(candles, 14).at(-1)).toBeCloseTo(2, 10);
  });
});

describe("adxSeries", () => {
  it("is 100 for a one-directional trend and 0 for a flat market", () => {
    const trend = candlesFromCloses(linearSeries(60, 100, 1), { wick: 0.2 });
    const flat = candlesFromCloses(Array(60).fill(100), { wick: 1 });
    expect(adxSeries(trend, 14)).toHaveLength(60 - 2 * 14 + 1);
    expect(adxSeries(trend, 14).at(-1)).toBeCloseTo(100, 8);
    expect(adxSeries(flat, 14).at(-1)).toBe(0);
  });
});

describe("volumeChangePct", () => {
  it("compares recent average volume with the baseline", () => {
    const candles = candlesFromCloses(Array(25).fill(100), {
      volume: (i) => (i >= 20 ? 200 : 100),
    });
    expect(volumeChangePct(candles, 5, 20)).toBeCloseTo(100, 10);
  });
});

describe("levels", () => {
  it("finds confirmed swing highs and lows", () => {
    const closes = [10, 11, 12, 15, 12, 11, 10, 8, 10, 11, 12];
    const candles = candlesFromCloses(closes, { wick: 0 }).map((c) => ({
      ...c,
      open: c.close,
      high: c.close,
      low: c.close,
    }));
    const { highs, lows } = findPivots(candles, 2);
    expect(highs).toEqual([15]);
    expect(lows).toEqual([8]);
  });

  it("clusters nearby levels", () => {
    expect(clusterLevels([100, 100.2, 105, 105.1], 0.5)).toEqual([100.1, 105.05]);
  });

  it("detects breakouts and breakdowns of the prior range", () => {
    const up = candlesFromCloses([...Array(20).fill(100), 110], { wick: 1 });
    const down = candlesFromCloses([...Array(20).fill(100), 90], { wick: 1 });
    expect(detectRangeBreak(up, 20)).toEqual({ breakout: true, breakdown: false });
    expect(detectRangeBreak(down, 20)).toEqual({ breakout: false, breakdown: true });
  });
});
