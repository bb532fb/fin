import { describe, expect, it } from "vitest";
import { resolveExpiry, resolveOutcome } from "@/lib/tracking/resolve-outcome";
import type { TrackedSignal } from "@/lib/tracking/resolve-outcome";
import type { Candle } from "@/types/market";

const MIN = 60_000;

const long: TrackedSignal = {
  direction: "LONG",
  entryMin: 99,
  entryMax: 100,
  stopLoss: 95,
  takeProfit: 110,
  createdAt: 0,
  expiresAt: 10 * MIN,
};

const short: TrackedSignal = {
  direction: "SHORT",
  entryMin: 100,
  entryMax: 101,
  stopLoss: 105,
  takeProfit: 90,
  createdAt: 0,
  expiresAt: 10 * MIN,
};

/** Candles from [low, high] pairs, one per minute starting at `startMinute`. */
function bars(ranges: [number, number][], startMinute = 0): Candle[] {
  return ranges.map(([low, high], i) => ({
    openTime: (startMinute + i) * MIN,
    closeTime: (startMinute + i + 1) * MIN - 1,
    open: low,
    high,
    low,
    close: high,
    volume: 1,
  }));
}

describe("resolveOutcome", () => {
  it("marks a LONG as WIN when target is reached after entry", () => {
    const result = resolveOutcome(long, bars([[99.5, 101], [100, 105], [104, 111]]), 3 * MIN);
    expect(result).toMatchObject({ status: "WIN", entryTriggeredAt: 0, priceAtResolution: 110 });
  });

  it("marks a LONG as LOSS when stop is reached after entry", () => {
    const result = resolveOutcome(long, bars([[99.5, 101], [94, 99]]), 2 * MIN);
    expect(result).toMatchObject({ status: "LOSS", priceAtResolution: 95 });
  });

  it("treats a candle touching both stop and target as LOSS", () => {
    const result = resolveOutcome(long, bars([[99.5, 101], [94, 111]]), 2 * MIN);
    expect(result.status).toBe("LOSS");
  });

  it("does not credit a target on the entry candle", () => {
    const result = resolveOutcome(long, bars([[99, 112]]), MIN);
    expect(result).toEqual({ status: "PENDING", entryTriggeredAt: 0 });
  });

  it("counts a stop on the entry candle as LOSS", () => {
    const result = resolveOutcome(long, bars([[94, 102]]), MIN);
    expect(result.status).toBe("LOSS");
  });

  it("fills a LONG limit when price gaps below the zone", () => {
    const result = resolveOutcome(long, bars([[96, 98], [97, 111]]), 2 * MIN);
    expect(result).toMatchObject({ status: "WIN", entryTriggeredAt: 0 });
  });

  it("ignores targets reached before entry and expires untriggered signals", () => {
    const result = resolveOutcome(long, bars([[101, 112], [102, 113]]), 11 * MIN);
    expect(result).toMatchObject({ status: "EXPIRED", entryTriggeredAt: null, priceAtResolution: 113 });
  });

  it("stays PENDING before expiry", () => {
    const result = resolveOutcome(long, bars([[99.5, 101]]), 2 * MIN);
    expect(result).toEqual({ status: "PENDING", entryTriggeredAt: 0 });
  });

  it("ignores candles outside the signal lifetime", () => {
    const early = bars([[90, 120]], -1);
    const late = bars([[90, 120]], 10);
    const result = resolveOutcome(long, [...early, ...late], 12 * MIN);
    expect(result).toEqual({ status: "PENDING", entryTriggeredAt: null });
  });

  it("mirrors the rules for SHORT signals", () => {
    expect(resolveOutcome(short, bars([[100, 101.5], [89, 99]]), 2 * MIN).status).toBe("WIN");
    expect(resolveOutcome(short, bars([[100, 101.5], [102, 106]]), 2 * MIN).status).toBe("LOSS");
    expect(resolveOutcome(short, bars([[95, 99], [89, 99]]), 2 * MIN).status).toBe("PENDING");
  });
});

describe("resolveExpiry", () => {
  const signal = {
    direction: "LONG" as const,
    price: 100,
    createdAt: 0,
    expiresAt: 5 * MIN,
  };

  it("waits until the minutes end", () => {
    expect(resolveExpiry(signal, bars([[99, 101]]), 2 * MIN)).toEqual({
      status: "PENDING",
      entryTriggeredAt: 0,
    });
  });

  it("wins only when price finishes strictly in the signal direction", () => {
    expect(resolveExpiry(signal, bars([[99, 101], [100, 103], [101, 104], [102, 105], [100, 102]]), 5 * MIN).status).toBe(
      "WIN",
    );
    expect(resolveExpiry({ ...signal, direction: "SHORT" }, bars([[99, 101]]), 5 * MIN).status).toBe("LOSS");
    expect(resolveExpiry(signal, bars([[100, 100]]), 5 * MIN).status).toBe("LOSS");
  });
});
