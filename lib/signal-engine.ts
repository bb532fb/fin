import { REGIME_FILTER, RISK_RULES, RSI_ZONES, SIGNAL_THRESHOLDS } from "@/lib/config/trading";
import { computeIndicatorSnapshot } from "@/lib/indicators/snapshot";
import { evaluateConditions } from "@/lib/signal/conditions";
import { assessRiskLevel, buildTradePlan } from "@/lib/signal/risk";
import { scoreSignal } from "@/lib/signal/scoring";
import { assessSetupQuality, higherTrendAllows } from "@/lib/signal/setup-quality";
import type { MarketSnapshot } from "@/types/market";
import type {
  EngineResult,
  IndicatorSnapshot,
  NoTradeCode,
  SignalCondition,
  SignalScores,
  TradeDirection,
  Trend,
} from "@/types/signal";

interface EngineContext extends SignalScores {
  indicators: IndicatorSnapshot;
  conditions: SignalCondition[];
}

export interface EvaluateOptions {
  /**
   * Trend on the next higher timeframe.
   * - omit: skip HTF filter (unit tests / research without HTF candles)
   * - null: no higher TF for this chart (e.g. 1d)
   * - Trend: reject trades that oppose it
   */
  higherTrend?: Trend | null;
}

interface Rejection {
  code: NoTradeCode;
  message: string;
}

function noTrade(context: EngineContext, rejection: Rejection): EngineResult {
  return { ...context, direction: "NO_TRADE", noTrade: rejection };
}

function htfConflict(
  direction: TradeDirection,
  higherTrend: Trend | null | undefined,
): boolean {
  if (higherTrend === undefined || higherTrend === null) return false;
  return !higherTrendAllows(direction, higherTrend);
}

/** Direction-agnostic filters: signal strength, agreement and market regime. */
function signalRejection(scores: SignalScores, indicators: IndicatorSnapshot): Rejection | null {
  if (scores.confidence < SIGNAL_THRESHOLDS.minConfidence) {
    return { code: "WEAK_SIGNAL", message: "Signal-ի ուժը նվազագույն շեմից ցածր է։" };
  }
  if (Math.abs(scores.bullScore - scores.bearScore) < SIGNAL_THRESHOLDS.minScoreMargin) {
    return { code: "MIXED_SIGNALS", message: "Աճի և անկման պայմանները չափազանց հավասարակշռված են։" };
  }
  if (indicators.adx < REGIME_FILTER.minAdx) {
    return {
      code: "RANGING",
      message: `ADX ${indicators.adx.toFixed(1)}-ը ${REGIME_FILTER.minAdx}-ից ցածր է. շուկան կողային է, trend-ի signal-ները անվստահելի են։`,
    };
  }
  return null;
}

function directionRejection(
  direction: TradeDirection,
  indicators: IndicatorSnapshot,
  higherTrend: Trend | null | undefined,
): Rejection | null {
  const opposingTrend = direction === "LONG" ? "BEARISH" : "BULLISH";
  if (indicators.trend === opposingTrend) {
    return { code: "TREND_CONFLICT", message: "Momentum-ը հակասում է հիմնական trend-ին։" };
  }
  if (htfConflict(direction, higherTrend)) {
    return { code: "HTF_CONFLICT", message: "Ավելի բարձր ժամանակաշրջանի trend-ը հակասում է այս signal-ին։" };
  }
  const overextended =
    direction === "LONG" ? indicators.rsi >= RSI_ZONES.overbought : indicators.rsi <= RSI_ZONES.oversold;
  if (overextended) {
    return {
      code: "OVEREXTENDED",
      message: `RSI ${indicators.rsi.toFixed(1)}-ը ծայրահեղ է. հիմա մտնելը նշանակում է հետապնդել շարժումը։`,
    };
  }
  return null;
}

/**
 * Pure and deterministic: identical input always yields identical output.
 * This is what makes backtesting and historical win-rate tracking possible.
 * Filters are applied in order and the first failure produces NO_TRADE.
 */
export function evaluateMarket(market: MarketSnapshot, options: EvaluateOptions = {}): EngineResult {
  const indicators = computeIndicatorSnapshot(market.candles, market.livePrice);
  const conditions = evaluateConditions(indicators);
  const scores = scoreSignal(conditions);
  const context: EngineContext = { ...scores, indicators, conditions };

  const signalIssue = signalRejection(scores, indicators);
  if (signalIssue) return noTrade(context, signalIssue);

  const direction = scores.bias === "BULLISH" ? "LONG" : "SHORT";
  const directionIssue = directionRejection(direction, indicators, options.higherTrend);
  if (directionIssue) return noTrade(context, directionIssue);

  const plan = buildTradePlan({
    direction,
    referencePrice: market.livePrice,
    snapshot: indicators,
    filters: market.filters,
  });
  if (!plan || plan.riskReward < RISK_RULES.minRiskReward) {
    const ratio = plan ? plan.riskReward.toFixed(2) : "n/a";
    return noTrade(context, {
      code: "POOR_RISK_REWARD",
      message: `Risk/reward ${ratio}-ը (commission-ով) ${RISK_RULES.minRiskReward} նվազագույնից ցածր է։`,
    });
  }

  const risk = assessRiskLevel(direction, plan, scores.confidence, indicators.rsi);
  const setupQuality = assessSetupQuality({
    direction,
    confidence: scores.confidence,
    riskReward: plan.riskReward,
    risk,
    stopBasis: plan.stopBasis,
    targetBasis: plan.targetBasis,
    higherTrend: options.higherTrend === undefined ? null : options.higherTrend,
  });
  if (!setupQuality) {
    return noTrade(context, {
      code: "HTF_CONFLICT",
      message: "Ավելի բարձր ժամանակաշրջանի trend-ը հակասում է այս signal-ին։",
    });
  }
  return { ...context, direction, plan, risk, setupQuality };
}
