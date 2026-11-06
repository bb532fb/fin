import { RISK_RULES, SETUP_QUALITY_BANDS } from "@/lib/config/trading";
import type {
  RiskLevel,
  SetupQuality,
  StopBasis,
  TargetBasis,
  TradeDirection,
  Trend,
} from "@/types/signal";

export interface SetupQualityInput {
  direction: TradeDirection;
  confidence: number;
  riskReward: number;
  risk: RiskLevel;
  stopBasis: StopBasis;
  targetBasis: TargetBasis;
  /** `null` when the chart has no higher timeframe (e.g. 1d). */
  higherTrend: Trend | null;
}

/** True when HTF does not oppose the trade direction. Neutral HTF is allowed. */
export function higherTrendAllows(direction: TradeDirection, higherTrend: Trend): boolean {
  if (higherTrend === "NEUTRAL") return true;
  return direction === "LONG" ? higherTrend === "BULLISH" : higherTrend === "BEARISH";
}

/**
 * A = strong aligned setup; B = solid; C = tradeable but weaker.
 * Missing HTF (1d) does not block A/B. An opposing HTF is not a setup at all:
 * the engine rejects it as NO_TRADE, and this returns null so it cannot be graded C.
 */
export function assessSetupQuality(input: SetupQualityInput): SetupQuality | null {
  const htfOk =
    input.higherTrend === null || higherTrendAllows(input.direction, input.higherTrend);
  if (!htfOk) return null;

  const htfConfirmed =
    input.higherTrend !== null && higherTrendAllows(input.direction, input.higherTrend);
  const structureOk = input.stopBasis === "STRUCTURE" && input.targetBasis === "STRUCTURE";

  if (
    input.confidence >= SETUP_QUALITY_BANDS.aConfidence &&
    input.riskReward >= SETUP_QUALITY_BANDS.aRiskReward &&
    input.risk !== "HIGH" &&
    structureOk &&
    (input.higherTrend === null || htfConfirmed)
  ) {
    return "A";
  }

  if (input.confidence >= SETUP_QUALITY_BANDS.bConfidence && input.riskReward >= RISK_RULES.minRiskReward) {
    return "B";
  }

  return "C";
}
