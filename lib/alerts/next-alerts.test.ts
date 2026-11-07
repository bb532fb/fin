import { describe, expect, it } from "vitest";
import { formatTradeAlert, msUntilMinuteSlot } from "@/lib/alerts/format-alert";
import { nextAlertState, toAlertDirection } from "@/lib/alerts/next-alerts";

describe("toAlertDirection", () => {
  it("sends an engine trade when the higher chart agrees or is neutral", () => {
    expect(
      toAlertDirection({
        direction: "SHORT",
        risk: "LOW",
        confidence: 80,
        higherTrend: "BEARISH",
      }),
    ).toBe("SHORT");
    expect(
      toAlertDirection({
        direction: "LONG",
        risk: "MEDIUM",
        confidence: 75,
        higherTrend: "BULLISH",
      }),
    ).toBe("LONG");
    expect(
      toAlertDirection({
        direction: "LONG",
        risk: "LOW",
        confidence: 90,
        higherTrend: "NEUTRAL",
      }),
    ).toBe("LONG");
  });

  it("stays quiet when the engine refused, HTF is opposite, risk is high, or score is under 60", () => {
    expect(
      toAlertDirection({
        direction: "NO_TRADE",
        risk: null,
        confidence: 85,
        higherTrend: "BEARISH",
      }),
    ).toBe("NO_TRADE");
    expect(
      toAlertDirection({
        direction: "LONG",
        risk: "LOW",
        confidence: 90,
        higherTrend: "BEARISH",
      }),
    ).toBe("NO_TRADE");
    expect(
      toAlertDirection({
        direction: "SHORT",
        risk: "LOW",
        confidence: 59,
        higherTrend: "BEARISH",
      }),
    ).toBe("NO_TRADE");
    expect(
      toAlertDirection({
        direction: "LONG",
        risk: "HIGH",
        confidence: 90,
        higherTrend: "BULLISH",
      }),
    ).toBe("NO_TRADE");
  });

  it("sends at 60 when the higher chart is not opposite", () => {
    expect(
      toAlertDirection({
        direction: "SHORT",
        risk: "LOW",
        confidence: 60,
        higherTrend: "BEARISH",
      }),
    ).toBe("SHORT");
  });
});

describe("nextAlertState", () => {
  it("sends a direction once, then stays quiet until it clears", () => {
    const first = nextAlertState(new Map(), [
      { id: "futures:BTCUSDT", direction: "SHORT" },
      { id: "futures:ETHUSDT", direction: "NO_TRADE" },
    ]);
    expect(first.send).toEqual([{ id: "futures:BTCUSDT", direction: "SHORT" }]);

    const repeat = nextAlertState(first.state, [
      { id: "futures:BTCUSDT", direction: "SHORT" },
      { id: "spot:BTCUSDT", direction: "LONG" },
    ]);
    expect(repeat.send.map((item) => item.id)).toEqual(["spot:BTCUSDT"]);

    const cleared = nextAlertState(repeat.state, [{ id: "futures:BTCUSDT", direction: "NO_TRADE" }]);
    const again = nextAlertState(cleared.state, [{ id: "futures:BTCUSDT", direction: "SHORT" }]);
    expect(again.send).toEqual([{ id: "futures:BTCUSDT", direction: "SHORT" }]);
  });
});

describe("msUntilMinuteSlot", () => {
  it("waits until just after the next minute when the current one is already underway", () => {
    const at = new Date("2026-11-05T21:05:40.000Z").getTime();
    expect(msUntilMinuteSlot(at)).toBe(22_000);
  });
});

describe("formatTradeAlert", () => {
  it("says which minute to open, which side, and for how long", () => {
    expect(
      formatTradeAlert({
        venue: "futures",
        symbol: "BTCUSDT",
        direction: "SHORT",
        timeframe: "5m",
        confidence: 72,
        at: new Date("2026-11-05T13:47:30.000Z"),
      }),
    ).toBe("Futures\nBTC/USDT\n17:45-ից բացիր ներքևը 5 րոպեով\nՈւժը՝ 72/100");
  });

  it("says the 3-minute candle that starts about a minute later", () => {
    expect(
      formatTradeAlert({
        venue: "futures",
        symbol: "BTCUSDT",
        direction: "LONG",
        timeframe: "3m",
        confidence: 70,
        at: new Date("2026-11-05T13:47:30.000Z"),
      }),
    ).toBe("Futures\nBTC/USDT\n17:48-ից բացիր վերևը 3 րոպեով\nՈւժը՝ 70/100");
  });

  it("names the next minute so there is time to open the trade", () => {
    expect(
      formatTradeAlert({
        venue: "pocket",
        symbol: "ETHUSDT",
        direction: "LONG",
        timeframe: "1m",
        confidence: 80,
        at: new Date("2026-11-05T14:00:00.000Z"),
      }),
    ).toBe("Pocket Option · ոչ OTC\nETH/USDT\n18:01-ից բացիր վերևը 1 րոպեով\nՈւժը՝ 80/100");
  });

  it("on a 1m chart sent early in the minute, names the following minute", () => {
    expect(
      formatTradeAlert({
        venue: "pocket",
        symbol: "ETHUSDT",
        direction: "SHORT",
        timeframe: "1m",
        confidence: 80,
        at: new Date("2026-11-05T21:05:15.000Z"),
      }),
    ).toBe("Pocket Option · ոչ OTC\nETH/USDT\n01:06-ից բացիր ներքևը 1 րոպեով\nՈւժը՝ 80/100");
  });

  it("skips a minute that would already be almost over", () => {
    expect(
      formatTradeAlert({
        venue: "pocket",
        symbol: "ETHUSDT",
        direction: "SHORT",
        timeframe: "1m",
        confidence: 80,
        at: new Date("2026-11-05T21:05:45.000Z"),
      }),
    ).toBe("Pocket Option · ոչ OTC\nETH/USDT\n01:07-ից բացիր ներքևը 1 րոպեով\nՈւժը՝ 80/100");
  });
});
