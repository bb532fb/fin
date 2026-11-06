import type { Candle } from "@/types/market";
import type { TradeDirection } from "@/types/signal";

export interface TrackedSignal {
  direction: TradeDirection;
  entryMin: number;
  entryMax: number;
  stopLoss: number;
  takeProfit: number;
  createdAt: number;
  expiresAt: number;
}

export type OutcomeUpdate =
  | { status: "PENDING"; entryTriggeredAt: number | null }
  | {
      status: "WIN" | "LOSS" | "EXPIRED";
      entryTriggeredAt: number | null;
      resolvedAt: number;
      priceAtResolution: number;
    };

/** A resting limit order fills once price trades at or through the zone edge closest to it. */
function entryFilled(signal: TrackedSignal, candle: Candle): boolean {
  return signal.direction === "LONG" ? candle.low <= signal.entryMax : candle.high >= signal.entryMin;
}

function stopHit(signal: TrackedSignal, candle: Candle): boolean {
  return signal.direction === "LONG" ? candle.low <= signal.stopLoss : candle.high >= signal.stopLoss;
}

function targetHit(signal: TrackedSignal, candle: Candle): boolean {
  return signal.direction === "LONG"
    ? candle.high >= signal.takeProfit
    : candle.low <= signal.takeProfit;
}

/**
 * Pocket Option non-OTC settles when the chosen minutes end.
 * Price must move strictly in the signal's direction; a tie is a loss.
 * Missing candles stay pending so a late fetch can still settle the trade.
 */
export function resolveExpiry(
  signal: { direction: TradeDirection; price: number; createdAt: number; expiresAt: number },
  candles: Candle[],
  now: number,
): OutcomeUpdate {
  let lastClose: number | null = null;
  let lastCloseTime = signal.createdAt;
  for (const candle of candles) {
    if (candle.openTime < signal.createdAt || candle.openTime >= signal.expiresAt) continue;
    lastClose = candle.close;
    lastCloseTime = candle.closeTime;
  }
  if (now < signal.expiresAt || lastClose === null) {
    return { status: "PENDING", entryTriggeredAt: signal.createdAt };
  }
  const win = signal.direction === "LONG" ? lastClose > signal.price : lastClose < signal.price;
  return {
    status: win ? "WIN" : "LOSS",
    entryTriggeredAt: signal.createdAt,
    resolvedAt: Math.min(lastCloseTime, signal.expiresAt),
    priceAtResolution: lastClose,
  };
}

/**
 * Replays candles after the signal to decide its outcome. Intra-candle order is unknown, so
 * every ambiguity resolves pessimistically: a candle touching both stop and target is a LOSS,
 * and the candle that fills the entry can only produce a LOSS (the target may have come first).
 * Candles opening before the signal or at/after expiry are ignored.
 */
export function resolveOutcome(signal: TrackedSignal, candles: Candle[], now: number): OutcomeUpdate {
  let entryTriggeredAt: number | null = null;
  let lastClose: number | null = null;

  for (const candle of candles) {
    if (candle.openTime < signal.createdAt || candle.openTime >= signal.expiresAt) continue;
    lastClose = candle.close;
    const resolvedAt = Math.min(candle.closeTime, now);

    if (entryTriggeredAt === null) {
      if (!entryFilled(signal, candle)) continue;
      entryTriggeredAt = candle.openTime;
      if (stopHit(signal, candle)) {
        return { status: "LOSS", entryTriggeredAt, resolvedAt, priceAtResolution: signal.stopLoss };
      }
      continue;
    }
    if (stopHit(signal, candle)) {
      return { status: "LOSS", entryTriggeredAt, resolvedAt, priceAtResolution: signal.stopLoss };
    }
    if (targetHit(signal, candle)) {
      return { status: "WIN", entryTriggeredAt, resolvedAt, priceAtResolution: signal.takeProfit };
    }
  }

  if (now < signal.expiresAt || lastClose === null) {
    return { status: "PENDING", entryTriggeredAt };
  }
  return {
    status: "EXPIRED",
    entryTriggeredAt,
    resolvedAt: signal.expiresAt,
    priceAtResolution: lastClose,
  };
}
