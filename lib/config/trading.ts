/**
 * Bump on ANY change to indicators, weights, thresholds or risk rules.
 * Stored with every analysis so historical performance is never mixed across logic versions.
 */
export const ENGINE_VERSION = "1.3.0";

export const INDICATOR_PERIODS = {
  rsi: 14,
  emaFast: 20,
  emaSlow: 50,
  emaTrend: 200,
  macdFast: 12,
  macdSlow: 26,
  macdSignal: 9,
  atr: 14,
  adx: 14,
} as const;

/** Trend-following rules lose their edge in ranges; below this ADX the result is NO_TRADE. */
export const REGIME_FILTER = { minAdx: 20 } as const;

/**
 * Per-side cost of every fill: Binance Spot taker fee plus a slippage allowance.
 * R/R is computed net of these costs, so tight stops on low timeframes are not overrated.
 */
export const TRADING_COSTS = { feeRate: 0.001, slippageRate: 0.0005 } as const;

/** EMA200 is only reported when enough history exists for it to converge. */
export const EMA_TREND_MIN_CANDLES = 300;

export const VOLUME_WINDOW = { recent: 5, baseline: 20 } as const;
export const VOLUME_RISING_THRESHOLD_PCT = 10;

export const LEVELS_CONFIG = {
  lookback: 200,
  pivotWindow: 3,
  clusterAtrMultiple: 0.25,
  breakoutLookback: 20,
} as const;

export const RSI_ZONES = {
  /** Inclusive. RSI 50 scores bull only — bear uses a strict upper bound. */
  bullMin: 50,
  bullMax: 70,
  bearMin: 30,
  /** Exclusive. RSI 50 is not a bear score, so the two zones cannot both be true. */
  bearMax: 50,
  /** No LONG at or above this RSI and no SHORT at or below `oversold` (avoid chasing extremes). */
  overbought: 75,
  oversold: 25,
} as const;

export const SIGNAL_THRESHOLDS = {
  /** Minimum confidence for any LONG/SHORT. Below this the result is NO_TRADE. */
  minConfidence: 60,
  /** Minimum gap between dominant and opposing score; otherwise signals are mixed. */
  minScoreMargin: 25,
  /** Share of the opposing score subtracted from the dominant score. */
  opposingPenaltyFactor: 0.5,
} as const;

/** Setup quality bands for trade signals (A = highest conviction). */
export const SETUP_QUALITY_BANDS = {
  aConfidence: 85,
  aRiskReward: 2,
  bConfidence: 70,
} as const;

export const STRENGTH_BANDS = {
  moderate: 55,
  strong: 70,
  veryStrong: 85,
} as const;

export const RISK_RULES = {
  minRiskReward: 1.5,
  entryZoneAtr: 0.3,
  stopBufferAtr: 0.5,
  minStopAtr: 1,
  maxStopAtr: 3,
  fallbackStopAtr: 2,
  targetBufferAtr: 0.1,
  /** Used only when no opposing level exists in the lookback (e.g. fresh breakout). */
  projectedTargetR: 2,
} as const;

/**
 * Points added by each risk condition. LOW at or under `lowMax`, MEDIUM at or under `mediumMax`,
 * otherwise HIGH.
 */
export const RISK_SCORE = {
  rewardBelow: 2,
  rewardPoints: 1,
  confidenceBelow: 70,
  confidencePoints: 1,
  stopMediumPct: 1.5,
  stopMediumPoints: 1,
  stopWidePct: 3,
  stopWidePoints: 2,
  rsiLongAbove: 70,
  rsiShortBelow: 30,
  rsiPoints: 1,
  projectedTargetPoints: 1,
  lowMax: 1,
  mediumMax: 3,
} as const;

/** Signals are considered expired after this many candles of the analysed timeframe. */
export const SIGNAL_EXPIRY_CANDLES = 24;

/** Position sizing defaults. Fee is Binance Spot's standard taker rate per side. */
export const POSITION_SIZING = {
  defaultRiskPct: 1,
  maxRiskPct: 2,
  feeRate: TRADING_COSTS.feeRate,
} as const;

export const DISCLAIMER =
  "Crypto AI Analyst-ը տալիս է միայն վերլուծական տեղեկություն և չի երաշխավորում առևտրային արդյունք։ Կրիպտո առևտուրը մեծ ֆինանսական ռիսկ է պարունակում։";

export const CONFIDENCE_DISCLAIMER =
  "Այս միավորը ցույց է տալիս signal-ի ուժը՝ ընթացիկ շուկայի և indicator-ների հիման վրա։ Այն չի երաշխավորում ապագա արդյունք։";

export const NO_TRADE_MESSAGE =
  "Ընթացիկ շուկայական պայմանները բավարար ուժեղ setup չեն տալիս։";
