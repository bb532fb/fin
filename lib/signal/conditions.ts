import { RSI_ZONES, VOLUME_RISING_THRESHOLD_PCT } from "@/lib/config/trading";
import type { ConditionSide, IndicatorSnapshot, SignalCondition } from "@/types/signal";

interface ConditionRule {
  id: string;
  label: string;
  side: ConditionSide;
  weight: number;
  /** Returns null when the condition cannot be evaluated (excluded from the maximum score). */
  evaluate: (s: IndicatorSnapshot) => boolean | null;
}

const volumeRising = (s: IndicatorSnapshot) => s.volumeChangePct >= VOLUME_RISING_THRESHOLD_PCT;

/** Bull and bear rules are mirrored and carry equal total weight (100 each). */
const RULES: readonly ConditionRule[] = [
  { id: "ema_fast_above_slow", label: "EMA20-ը EMA50-ից վեր", side: "BULL", weight: 15, evaluate: (s) => s.ema20 > s.ema50 },
  { id: "price_above_ema50", label: "Գինը EMA50-ից վեր", side: "BULL", weight: 10, evaluate: (s) => s.closePrice > s.ema50 },
  { id: "ema50_above_ema200", label: "EMA50-ը EMA200-ից վեր", side: "BULL", weight: 10, evaluate: (s) => (s.ema200 === null ? null : s.ema50 > s.ema200) },
  { id: "macd_bullish", label: "MACD գիծը signal գծից վեր", side: "BULL", weight: 15, evaluate: (s) => s.macd.state === "BULLISH" },
  { id: "macd_momentum_up", label: "MACD histogram-ը բարձրանում է", side: "BULL", weight: 10, evaluate: (s) => s.macd.histogram > s.macd.previousHistogram },
  { id: "rsi_bull_zone", label: `RSI աճային գոտում (${RSI_ZONES.bullMin}≤RSI≤${RSI_ZONES.bullMax})`, side: "BULL", weight: 15, evaluate: (s) => s.rsi >= RSI_ZONES.bullMin && s.rsi <= RSI_ZONES.bullMax },
  { id: "volume_confirms_up", label: "Աճող volume աճային candle-ով", side: "BULL", weight: 10, evaluate: (s) => volumeRising(s) && s.lastCandleBullish },
  { id: "range_breakout", label: "Փակումը վերջին միջակայքի բարձրից վեր", side: "BULL", weight: 15, evaluate: (s) => s.breakout },

  { id: "ema_fast_below_slow", label: "EMA20-ը EMA50-ից ներքև", side: "BEAR", weight: 15, evaluate: (s) => s.ema20 < s.ema50 },
  { id: "price_below_ema50", label: "Գինը EMA50-ից ներքև", side: "BEAR", weight: 10, evaluate: (s) => s.closePrice < s.ema50 },
  { id: "ema50_below_ema200", label: "EMA50-ը EMA200-ից ներքև", side: "BEAR", weight: 10, evaluate: (s) => (s.ema200 === null ? null : s.ema50 < s.ema200) },
  { id: "macd_bearish", label: "MACD գիծը signal գծից ներքև", side: "BEAR", weight: 15, evaluate: (s) => s.macd.state === "BEARISH" },
  { id: "macd_momentum_down", label: "MACD histogram-ը իջնում է", side: "BEAR", weight: 10, evaluate: (s) => s.macd.histogram < s.macd.previousHistogram },
  { id: "rsi_bear_zone", label: `RSI անկումային գոտում (${RSI_ZONES.bearMin}≤RSI<${RSI_ZONES.bearMax})`, side: "BEAR", weight: 15, evaluate: (s) => s.rsi >= RSI_ZONES.bearMin && s.rsi < RSI_ZONES.bearMax },
  { id: "volume_confirms_down", label: "Աճող volume անկումային candle-ով", side: "BEAR", weight: 10, evaluate: (s) => volumeRising(s) && !s.lastCandleBullish },
  { id: "range_breakdown", label: "Փակումը վերջին միջակայքի ցածրից ներքև", side: "BEAR", weight: 15, evaluate: (s) => s.breakdown },
];

export function evaluateConditions(snapshot: IndicatorSnapshot): SignalCondition[] {
  const conditions: SignalCondition[] = [];
  for (const rule of RULES) {
    const met = rule.evaluate(snapshot);
    if (met === null) continue;
    conditions.push({ id: rule.id, label: rule.label, side: rule.side, weight: rule.weight, met });
  }
  return conditions;
}
