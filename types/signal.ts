export const DIRECTIONS = ["LONG", "SHORT", "NO_TRADE"] as const;
export const TRENDS = ["BULLISH", "BEARISH", "NEUTRAL"] as const;
export const MACD_STATES = ["BULLISH", "BEARISH", "NEUTRAL"] as const;
export const SIGNAL_STRENGTHS = ["LOW", "MODERATE", "STRONG", "VERY_STRONG"] as const;
export const RISK_LEVELS = ["LOW", "MEDIUM", "HIGH"] as const;
export const STOP_BASES = ["STRUCTURE", "VOLATILITY"] as const;
export const TARGET_BASES = ["STRUCTURE", "PROJECTED"] as const;
export const NO_TRADE_CODES = [
  "WEAK_SIGNAL",
  "MIXED_SIGNALS",
  "RANGING",
  "TREND_CONFLICT",
  "HTF_CONFLICT",
  "OVEREXTENDED",
  "POOR_RISK_REWARD",
] as const;
export const SETUP_QUALITIES = ["A", "B", "C"] as const;
export const CONDITION_SIDES = ["BULL", "BEAR"] as const;

export type Direction = (typeof DIRECTIONS)[number];
export type TradeDirection = Exclude<Direction, "NO_TRADE">;
export type Trend = (typeof TRENDS)[number];
export type MacdState = (typeof MACD_STATES)[number];
export type SignalStrength = (typeof SIGNAL_STRENGTHS)[number];
export type RiskLevel = (typeof RISK_LEVELS)[number];
export type StopBasis = (typeof STOP_BASES)[number];
export type TargetBasis = (typeof TARGET_BASES)[number];
export type NoTradeCode = (typeof NO_TRADE_CODES)[number];
export type SetupQuality = (typeof SETUP_QUALITIES)[number];
export type ConditionSide = (typeof CONDITION_SIDES)[number];

export interface MacdSnapshot {
  line: number;
  signal: number;
  histogram: number;
  previousHistogram: number;
  state: MacdState;
}

export interface IndicatorSnapshot {
  /** Close of the last closed candle. */
  closePrice: number;
  rsi: number;
  ema20: number;
  ema50: number;
  ema200: number | null;
  macd: MacdSnapshot;
  atr: number;
  adx: number;
  volumeChangePct: number;
  lastCandleBullish: boolean;
  /** Below the reference price, nearest first. */
  supports: number[];
  /** Above the reference price, nearest first. */
  resistances: number[];
  breakout: boolean;
  breakdown: boolean;
  trend: Trend;
}

export interface SignalCondition {
  id: string;
  label: string;
  side: ConditionSide;
  weight: number;
  met: boolean;
}

export interface TradePlan {
  entryMin: number;
  entryMax: number;
  stopLoss: number;
  takeProfit: number;
  /** Net of TRADING_COSTS on entry and exit. */
  riskReward: number;
  stopBasis: StopBasis;
  targetBasis: TargetBasis;
}

export interface SignalScores {
  bullScore: number;
  bearScore: number;
  /** Direction favoured by scores before any filters; may still end as NO_TRADE. */
  bias: Trend;
  confidence: number;
  signalStrength: SignalStrength;
}

interface EngineResultBase extends SignalScores {
  indicators: IndicatorSnapshot;
  conditions: SignalCondition[];
}

export interface TradeEngineResult extends EngineResultBase {
  direction: TradeDirection;
  plan: TradePlan;
  risk: RiskLevel;
  setupQuality: SetupQuality;
}

export interface NoTradeEngineResult extends EngineResultBase {
  direction: "NO_TRADE";
  noTrade: { code: NoTradeCode; message: string };
}

export type EngineResult = TradeEngineResult | NoTradeEngineResult;
