import { RISK_RULES, RISK_SCORE, TRADING_COSTS } from "@/lib/config/trading";
import { floorTo, roundToTick } from "@/lib/signal/price";
import type { SymbolFilters } from "@/types/market";
import type {
  IndicatorSnapshot,
  RiskLevel,
  StopBasis,
  TargetBasis,
  TradeDirection,
  TradePlan,
} from "@/types/signal";

interface PlanInput {
  direction: TradeDirection;
  referencePrice: number;
  snapshot: IndicatorSnapshot;
  filters: SymbolFilters;
}

/**
 * Works in "distance from entry" space so LONG and SHORT share one implementation.
 * sign = +1 for LONG (stop below, target above), -1 for SHORT.
 */
function rawPlan({ direction, referencePrice: ref, snapshot }: PlanInput) {
  const sign = direction === "LONG" ? 1 : -1;
  const atr = snapshot.atr;
  const worstEntry = ref;
  const zoneEdge = ref - sign * RISK_RULES.entryZoneAtr * atr;

  const stopLevel = direction === "LONG" ? snapshot.supports[0] : snapshot.resistances[0];
  const structureStop =
    stopLevel === undefined ? undefined : stopLevel - sign * RISK_RULES.stopBufferAtr * atr;
  const structureDistance =
    structureStop === undefined ? undefined : sign * (worstEntry - structureStop);
  const beyondLevel =
    structureStop !== undefined &&
    stopLevel !== undefined &&
    sign * (stopLevel - structureStop) > 0;
  const useStructure =
    structureDistance !== undefined &&
    beyondLevel &&
    structureDistance > 0 &&
    structureDistance <= RISK_RULES.maxStopAtr * atr;
  let stop = useStructure
    ? (structureStop as number)
    : worstEntry - sign * RISK_RULES.fallbackStopAtr * atr;
  if (sign * (worstEntry - stop) < RISK_RULES.minStopAtr * atr) {
    stop = worstEntry - sign * RISK_RULES.minStopAtr * atr;
  }
  let stopBasis: StopBasis = useStructure ? "STRUCTURE" : "VOLATILITY";
  if (stopBasis === "STRUCTURE" && stopLevel !== undefined && sign * (stopLevel - stop) <= 0) {
    stopBasis = "VOLATILITY";
  }

  const targetLevels = direction === "LONG" ? snapshot.resistances : snapshot.supports;
  const buffered = targetLevels
    .map((level) => level - sign * RISK_RULES.targetBufferAtr * atr)
    .find((level) => sign * (level - worstEntry) > 0);
  const targetBasis: TargetBasis = buffered === undefined ? "PROJECTED" : "STRUCTURE";
  const target =
    buffered ?? worstEntry + sign * RISK_RULES.projectedTargetR * Math.abs(worstEntry - stop);

  return { sign, worstEntry, zoneEdge, stop, target, stopBasis, targetBasis, stopLevel };
}

/** Returns null when the geometry is invalid (e.g. stop on the wrong side after rounding). */
export function buildTradePlan(input: PlanInput): TradePlan | null {
  const { filters, direction } = input;
  const raw = rawPlan(input);
  const isLong = direction === "LONG";

  const worstEntry = roundToTick(raw.worstEntry, filters, "nearest");
  const zoneEdge = roundToTick(raw.zoneEdge, filters, "nearest");
  let stopLoss = roundToTick(raw.stop, filters, isLong ? "down" : "up");
  const takeProfit = roundToTick(raw.target, filters, isLong ? "down" : "up");

  if (raw.stopBasis === "STRUCTURE" && raw.stopLevel !== undefined) {
    const beyond = isLong ? stopLoss < raw.stopLevel : stopLoss > raw.stopLevel;
    if (!beyond) {
      const nudged = isLong ? raw.stopLevel - filters.tickSize : raw.stopLevel + filters.tickSize;
      stopLoss = roundToTick(nudged, filters, isLong ? "down" : "up");
    }
    const stillBeyond = isLong ? stopLoss < raw.stopLevel : stopLoss > raw.stopLevel;
    if (!stillBeyond) return null;
  }

  const grossRisk = raw.sign * (worstEntry - stopLoss);
  const grossReward = raw.sign * (takeProfit - worstEntry);
  if (grossRisk <= 0 || grossReward <= 0 || raw.sign * (zoneEdge - stopLoss) <= 0) return null;

  const costRate = TRADING_COSTS.feeRate + TRADING_COSTS.slippageRate;
  const risk = grossRisk + costRate * (worstEntry + stopLoss);
  const reward = grossReward - costRate * (worstEntry + takeProfit);
  if (reward <= 0) return null;

  return {
    entryMin: Math.min(worstEntry, zoneEdge),
    entryMax: Math.max(worstEntry, zoneEdge),
    stopLoss,
    takeProfit,
    riskReward: floorTo(reward / risk, 2),
    stopBasis: raw.stopBasis,
    targetBasis: raw.targetBasis,
  };
}

export function assessRiskLevel(
  direction: TradeDirection,
  plan: TradePlan,
  confidence: number,
  rsi: number,
): RiskLevel {
  const worstEntry = direction === "LONG" ? plan.entryMax : plan.entryMin;
  const stopDistancePct = (Math.abs(worstEntry - plan.stopLoss) / worstEntry) * 100;
  let points = 0;
  if (plan.riskReward < RISK_SCORE.rewardBelow) points += RISK_SCORE.rewardPoints;
  if (confidence < RISK_SCORE.confidenceBelow) points += RISK_SCORE.confidencePoints;
  if (stopDistancePct > RISK_SCORE.stopWidePct) points += RISK_SCORE.stopWidePoints;
  else if (stopDistancePct > RISK_SCORE.stopMediumPct) points += RISK_SCORE.stopMediumPoints;
  if (
    (direction === "LONG" && rsi > RISK_SCORE.rsiLongAbove) ||
    (direction === "SHORT" && rsi < RISK_SCORE.rsiShortBelow)
  ) {
    points += RISK_SCORE.rsiPoints;
  }
  if (plan.targetBasis === "PROJECTED") points += RISK_SCORE.projectedTargetPoints;

  if (points <= RISK_SCORE.lowMax) return "LOW";
  if (points <= RISK_SCORE.mediumMax) return "MEDIUM";
  return "HIGH";
}
