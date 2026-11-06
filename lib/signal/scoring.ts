import { SIGNAL_THRESHOLDS, STRENGTH_BANDS } from "@/lib/config/trading";
import type {
  ConditionSide,
  SignalCondition,
  SignalScores,
  SignalStrength,
  Trend,
} from "@/types/signal";

function sideScore(conditions: readonly SignalCondition[], side: ConditionSide): number {
  let max = 0;
  let met = 0;
  for (const condition of conditions) {
    if (condition.side !== side) continue;
    max += condition.weight;
    if (condition.met) met += condition.weight;
  }
  return max === 0 ? 0 : (met / max) * 100;
}

export function toSignalStrength(confidence: number): SignalStrength {
  if (confidence >= STRENGTH_BANDS.veryStrong) return "VERY_STRONG";
  if (confidence >= STRENGTH_BANDS.strong) return "STRONG";
  if (confidence >= STRENGTH_BANDS.moderate) return "MODERATE";
  return "LOW";
}

/**
 * confidence = dominantScore - opposingScore * factor, clamped to 0..100.
 * It measures how aligned current conditions are, not a probability of profit.
 */
export function scoreSignal(conditions: readonly SignalCondition[]): SignalScores {
  const bullScore = sideScore(conditions, "BULL");
  const bearScore = sideScore(conditions, "BEAR");
  const bias: Trend =
    bullScore > bearScore ? "BULLISH" : bearScore > bullScore ? "BEARISH" : "NEUTRAL";

  const dominant = Math.max(bullScore, bearScore);
  const opposing = Math.min(bullScore, bearScore);
  const raw = dominant - opposing * SIGNAL_THRESHOLDS.opposingPenaltyFactor;
  const confidence = bias === "NEUTRAL" ? 0 : Math.round(Math.min(100, Math.max(0, raw)));

  return {
    bullScore: Math.round(bullScore),
    bearScore: Math.round(bearScore),
    bias,
    confidence,
    signalStrength: toSignalStrength(confidence),
  };
}
