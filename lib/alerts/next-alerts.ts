import type { RiskLevel, Trend } from "@/types/signal";

/** Telegram stays quieter than the site. Under 60 and a neutral higher chart do not send. */
const ALERT_MIN_CONFIDENCE = 60;

/**
 * Only a direction the engine itself accepted.
 * 1m and 3m must agree with the 15m trend, 5m with the 1h trend.
 * That trend is already the `higherTrend` stored on the scan.
 */
export function toAlertDirection(item: {
  direction: "LONG" | "SHORT" | "NO_TRADE";
  risk: RiskLevel | null;
  confidence: number;
  higherTrend: Trend | null;
}): "LONG" | "SHORT" | "NO_TRADE" {
  if (item.direction !== "LONG" && item.direction !== "SHORT") return "NO_TRADE";
  if (item.risk === "HIGH" || item.confidence < ALERT_MIN_CONFIDENCE) return "NO_TRADE";
  const aligned = item.direction === "LONG" ? "BULLISH" : "BEARISH";
  if (item.higherTrend !== aligned) return "NO_TRADE";
  return item.direction;
}

export interface AlertCandidate {
  /** Venue and symbol together, so Spot and Futures of the same coin stay separate. */
  id: string;
  /** NO_TRADE clears the previous alert so the next real signal can be sent again. */
  direction: "LONG" | "SHORT" | "NO_TRADE";
}

/**
 * One message per new direction. Repeating the same LONG/SHORT stays quiet.
 * After NO_TRADE, the same direction can be sent again.
 */
export function nextAlertState(
  previous: ReadonlyMap<string, string>,
  items: readonly AlertCandidate[],
): { state: Map<string, string>; send: AlertCandidate[] } {
  const state = new Map(previous);
  const send: AlertCandidate[] = [];
  for (const item of items) {
    const prior = state.get(item.id);
    if ((item.direction === "LONG" || item.direction === "SHORT") && prior !== item.direction) {
      send.push(item);
    }
    state.set(item.id, item.direction);
  }
  return { state, send };
}
