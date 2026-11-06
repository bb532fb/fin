/**
 * Research-only backtest helpers. Does NOT modify production engine.
 */
import { CANDLE_FETCH_LIMIT, TIMEFRAME_MS, higherTimeframe } from "@/lib/config/market";
import type { SupportedSymbol, Timeframe } from "@/lib/config/market";
import { RESOLUTION_TIMEFRAME } from "@/lib/config/tracking";
import { SIGNAL_EXPIRY_CANDLES, TRADING_COSTS } from "@/lib/config/trading";
import { atrSeries } from "@/lib/indicators/atr";
import { emaSeries } from "@/lib/indicators/ema";
import { lastValue } from "@/lib/indicators/series";
import { computeIndicatorSnapshot } from "@/lib/indicators/snapshot";
import { evaluateMarket } from "@/lib/signal-engine";
import { resolveOutcome } from "@/lib/tracking/resolve-outcome";
import type { Candle, SymbolFilters } from "@/types/market";
import type { EngineResult, SignalCondition, TradeDirection, Trend } from "@/types/signal";

export const FEE = TRADING_COSTS.feeRate;
export const SLIP = TRADING_COSTS.slippageRate;
export const COST = FEE + SLIP;
/** Production analyses the last CANDLE_FETCH_LIMIT - 1 closed candles (the open one is dropped). */
export const WARMUP = CANDLE_FETCH_LIMIT - 1;

/** Kline field 9: base volume bought by takers. Research-only; production Candle omits it. */
export interface ResearchCandle extends Candle {
  takerBuyVolume: number;
}
export const TARGET_ANALYZED = 10_000;

export type SplitName = "TRAIN" | "VALIDATION" | "TEST";
export type Gate = (ctx: SignalContext) => boolean;

export interface SignalContext {
  symbol: SupportedSymbol;
  timeframe: Timeframe;
  index: number;
  analyzedPos: number;
  split: SplitName;
  createdAt: number;
  window: Candle[];
  result: Extract<EngineResult, { direction: "LONG" | "SHORT" }>;
  htf: {
    trend1h: Trend | null;
    trend4h: Trend | null;
    trend1d: Trend | null;
  };
  extras: {
    ema20Slope: number;
    ema50Slope: number;
    rvol: number;
    atrPct: number;
    atrPctile: number;
    regime: "TRENDING" | "RANGING" | "HIGH_VOL" | "LOW_VOL";
    strictBull: boolean;
    strictBear: boolean;
    /** Net taker flow (buy - sell) / volume over the last 5 and 20 candles, in -1..1. */
    cvd5: number;
    cvd20: number;
  };
}

export interface TradeRow {
  symbol: string;
  timeframe: Timeframe;
  split: SplitName;
  t: number;
  direction: TradeDirection;
  confidence: number;
  plannedRr: number;
  status: "WIN" | "LOSS" | "EXPIRED_OPEN" | "EXPIRED_UNFILLED";
  realizedReal: number | null;
  conditions: SignalCondition[];
}

const BASE = process.env.BINANCE_API_BASE_URL || "https://data-api.binance.vision";

export async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function fetchKlines(
  symbol: string,
  interval: string,
  endTime: number,
  limit: number,
): Promise<ResearchCandle[]> {
  const q = new URLSearchParams({
    symbol,
    interval,
    endTime: String(endTime),
    limit: String(limit),
  });
  for (let attempt = 1; attempt <= 6; attempt++) {
    const res = await fetch(`${BASE}/api/v3/klines?${q}`, { cache: "no-store" });
    if (res.status === 429) {
      await sleep(800 * attempt);
      continue;
    }
    if (!res.ok) throw new Error(`klines ${symbol} ${interval} ${res.status}`);
    const raw = (await res.json()) as (string | number)[][];
    return raw.map((r) => ({
      openTime: Number(r[0]),
      open: Number(r[1]),
      high: Number(r[2]),
      low: Number(r[3]),
      close: Number(r[4]),
      volume: Number(r[5]),
      closeTime: Number(r[6]),
      takerBuyVolume: Number(r[9]),
    }));
  }
  throw new Error(`klines rate-limited ${symbol} ${interval}`);
}

export async function fetchHistory(
  symbol: string,
  interval: string,
  need: number,
  endAt = Date.now(),
): Promise<ResearchCandle[]> {
  const map = new Map<number, ResearchCandle>();
  let end = endAt;
  let guard = 0;
  while (map.size < need && guard < 400) {
    guard += 1;
    const batch = await fetchKlines(symbol, interval, end, 1000);
    if (batch.length === 0) break;
    for (const c of batch) map.set(c.openTime, c);
    end = batch[0]!.openTime - 1;
    if (batch.length < 1000) break;
    await sleep(35);
  }
  return [...map.values()].sort((a, b) => a.openTime - b.openTime);
}

export function chronologicalSplits(
  analyzedCount: number,
): Record<SplitName, { start: number; end: number }> {
  const trainEnd = Math.floor(analyzedCount * 0.6);
  const valEnd = Math.floor(analyzedCount * 0.8);
  return {
    TRAIN: { start: 0, end: trainEnd },
    VALIDATION: { start: trainEnd, end: valEnd },
    TEST: { start: valEnd, end: analyzedCount },
  };
}

function entryPrice(direction: TradeDirection, entryMin: number, entryMax: number) {
  return direction === "LONG" ? entryMax : entryMin;
}

export function realizedR(
  direction: TradeDirection,
  entry: number,
  stop: number,
  exit: number,
  kind: "WIN" | "LOSS" | "MTM",
): number {
  if (kind === "LOSS") return -1;
  const risk = Math.abs(entry - stop) + COST * (entry + stop);
  const move = direction === "LONG" ? exit - entry : entry - exit;
  const reward = move - COST * (entry + exit);
  return risk > 0 ? reward / risk : 0;
}

/** Index of the last candle with closeTime <= t (candles sorted ascending), or -1. */
function lastClosedIndex(candles: readonly Candle[], atCloseTime: number): number {
  let lo = 0;
  let hi = candles.length - 1;
  let best = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (candles[mid]!.closeTime <= atCloseTime) {
      best = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return best;
}

type TrendMemo = Map<number, Trend | null>;

/** Same computation as production `loadMarketWithHtf`: trend of the last WARMUP closed HTF candles. */
function htfTrendAt(candles: readonly Candle[], atCloseTime: number, memo: TrendMemo): Trend | null {
  const best = lastClosedIndex(candles, atCloseTime);
  if (best < WARMUP - 1) return null;
  const cached = memo.get(best);
  if (cached !== undefined) return cached;
  const window = candles.slice(best - (WARMUP - 1), best + 1);
  const trend = computeIndicatorSnapshot(window, window.at(-1)!.close).trend;
  memo.set(best, trend);
  return trend;
}

function netTakerFlow(window: readonly ResearchCandle[], count: number): number {
  let net = 0;
  let total = 0;
  for (const c of window.slice(-count)) {
    net += 2 * c.takerBuyVolume - c.volume;
    total += c.volume;
  }
  return total > 0 ? net / total : 0;
}

function buildExtras(window: ResearchCandle[]) {
  const closes = window.map((c) => c.close);
  const vols = window.map((c) => c.volume);
  const ema20s = emaSeries(closes, 20);
  const ema50s = emaSeries(closes, 50);
  const ema20 = lastValue(ema20s, "e20");
  const ema50 = lastValue(ema50s, "e50");
  const ema200 = closes.length >= 300 ? lastValue(emaSeries(closes, 200), "e200") : null;
  const close = window.at(-1)!.close;
  const slopeN = 5;
  const ema20Slope =
    ema20s.length > slopeN ? ema20 - (ema20s[ema20s.length - 1 - slopeN] as number) : 0;
  const ema50Slope =
    ema50s.length > slopeN ? ema50 - (ema50s[ema50s.length - 1 - slopeN] as number) : 0;
  const baseAvg = vols.slice(-25, -5).reduce((a, b) => a + b, 0) / 20;
  const recentAvg = vols.slice(-5).reduce((a, b) => a + b, 0) / 5;
  const rvol = baseAvg > 0 ? recentAvg / baseAvg : 1;
  const atrs = atrSeries(window, 14);
  const atr = lastValue(atrs, "atr");
  const atrPct = (atr / close) * 100;
  const look = atrs.slice(-100);
  const below = look.filter((v) => v <= atr).length;
  const atrPctile = look.length ? below / look.length : 0.5;
  const strictBull = ema200 !== null && close > ema20 && ema20 > ema50 && ema50 > ema200;
  const strictBear = ema200 !== null && close < ema20 && ema20 < ema50 && ema50 < ema200;
  let regime: SignalContext["extras"]["regime"] = "RANGING";
  if (atrPctile >= 0.8) regime = "HIGH_VOL";
  else if (atrPctile <= 0.2) regime = "LOW_VOL";
  else if (strictBull || strictBear) regime = "TRENDING";
  return {
    ema20Slope,
    ema50Slope,
    rvol,
    atrPct,
    atrPctile,
    regime,
    strictBull,
    strictBear,
    cvd5: netTakerFlow(window, 5),
    cvd20: netTakerFlow(window, 20),
  };
}

export interface ComboBundle {
  symbol: SupportedSymbol;
  timeframe: Timeframe;
  candles: Candle[];
  resCandles: Candle[];
  filters: SymbolFilters;
  htf1h: Candle[];
  htf4h: Candle[];
  htf1d: Candle[];
  analyzedIndices: number[];
  /** Precomputed trade signals (NO_TRADE skipped). */
  signals: SignalContext[];
}

export async function loadCombo(
  symbol: SupportedSymbol,
  timeframe: Timeframe,
  filters: SymbolFilters,
): Promise<ComboBundle> {
  const need = WARMUP + TARGET_ANALYZED + SIGNAL_EXPIRY_CANDLES + 5;
  const candles = await fetchHistory(symbol, timeframe, need);
  const maxI = candles.length - 1 - SIGNAL_EXPIRY_CANDLES;
  const analyzedIndices: number[] = [];
  for (let i = WARMUP - 1; i <= maxI && analyzedIndices.length < TARGET_ANALYZED; i++) {
    analyzedIndices.push(i);
  }
  const start = candles[analyzedIndices[0]!]!.openTime;
  const end = candles[analyzedIndices.at(-1)! + SIGNAL_EXPIRY_CANDLES]!.closeTime;
  const resTf = RESOLUTION_TIMEFRAME[timeframe];
  const resNeed = Math.ceil(((end - start) / TIMEFRAME_MS[resTf]) * 1.05) + 50;
  const resCandles = await fetchHistory(symbol, resTf, Math.min(resNeed, 220_000), end + 1);
  const htf1h = await fetchHistory(symbol, "1h", Math.min(need, 12_000), end + 1);
  const htf4h = await fetchHistory(symbol, "4h", Math.min(need, 8_000), end + 1);
  const htf1d = await fetchHistory(symbol, "1d", Math.min(need, 3_000), end + 1);

  const htfByTimeframe: Partial<Record<Timeframe, ResearchCandle[]>> = {
    "1h": htf1h,
    "4h": htf4h,
    "1d": htf1d,
  };
  const memos = { "1h": new Map(), "4h": new Map(), "1d": new Map() } as Record<string, TrendMemo>;
  const trendOn = (tf: Timeframe, at: number) =>
    htfTrendAt(htfByTimeframe[tf] ?? [], at, memos[tf] ?? new Map());
  const productionHtf = higherTimeframe(timeframe);

  const splits = chronologicalSplits(analyzedIndices.length);
  const signals: SignalContext[] = [];
  for (let pos = 0; pos < analyzedIndices.length; pos++) {
    const i = analyzedIndices[pos]!;
    const window = candles.slice(Math.max(0, i - (WARMUP - 1)), i + 1);
    const createdAt = candles[i]!.closeTime;
    let result: EngineResult;
    try {
      result = evaluateMarket(
        { candles: window, livePrice: window.at(-1)!.close, filters },
        { higherTrend: productionHtf ? trendOn(productionHtf, createdAt) : null },
      );
    } catch {
      continue;
    }
    if (result.direction === "NO_TRADE") continue;
    const split: SplitName =
      pos < splits.TRAIN.end ? "TRAIN" : pos < splits.VALIDATION.end ? "VALIDATION" : "TEST";
    signals.push({
      symbol,
      timeframe,
      index: i,
      analyzedPos: pos,
      split,
      createdAt,
      window,
      result,
      htf: {
        trend1h: trendOn("1h", createdAt),
        trend4h: trendOn("4h", createdAt),
        trend1d: trendOn("1d", createdAt),
      },
      extras: buildExtras(window),
    });
  }

  return {
    symbol,
    timeframe,
    candles,
    resCandles,
    filters,
    htf1h,
    htf4h,
    htf1d,
    analyzedIndices,
    signals,
  };
}

function resolveSignal(bundle: ComboBundle, ctx: SignalContext): TradeRow {
  const { result, createdAt, split } = ctx;
  const expiresAt = createdAt + SIGNAL_EXPIRY_CANDLES * TIMEFRAME_MS[bundle.timeframe];
  const future = bundle.resCandles.filter((c) => c.openTime >= createdAt && c.openTime < expiresAt);
  const outcome = resolveOutcome(
    {
      direction: result.direction,
      entryMin: result.plan.entryMin,
      entryMax: result.plan.entryMax,
      stopLoss: result.plan.stopLoss,
      takeProfit: result.plan.takeProfit,
      createdAt,
      expiresAt,
    },
    future,
    expiresAt + 1,
  );
  const entry = entryPrice(result.direction, result.plan.entryMin, result.plan.entryMax);
  const base = {
    symbol: bundle.symbol,
    timeframe: bundle.timeframe,
    split,
    t: createdAt,
    direction: result.direction,
    confidence: result.confidence,
    plannedRr: result.plan.riskReward,
    conditions: result.conditions,
  };
  if (outcome.status === "WIN") {
    return {
      ...base,
      status: "WIN",
      realizedReal: realizedR(result.direction, entry, result.plan.stopLoss, result.plan.takeProfit, "WIN"),
    };
  }
  if (outcome.status === "LOSS") {
    return { ...base, status: "LOSS", realizedReal: -1 };
  }
  if (outcome.status === "PENDING" || outcome.entryTriggeredAt === null) {
    return { ...base, status: "EXPIRED_UNFILLED", realizedReal: null };
  }
  return {
    ...base,
    status: "EXPIRED_OPEN",
    realizedReal: realizedR(
      result.direction,
      entry,
      result.plan.stopLoss,
      outcome.priceAtResolution,
      "MTM",
    ),
  };
}

export function simulateCombo(
  bundle: ComboBundle,
  gate: Gate | null,
  options: { includeTest: boolean } = { includeTest: false },
): TradeRow[] {
  const trades: TradeRow[] = [];
  for (const ctx of bundle.signals) {
    if (ctx.split === "TEST" && !options.includeTest) continue;
    if (gate && !gate(ctx)) continue;
    trades.push(resolveSignal(bundle, ctx));
  }
  return trades;
}

export interface Metrics {
  trades: number;
  wins: number;
  losses: number;
  winRate: number | null;
  expectancy: number | null;
  profitFactor: number | null;
  maxDrawdownR: number;
  averageR: number | null;
  longTrades: number;
  shortTrades: number;
  longWinRate: number | null;
  shortWinRate: number | null;
  longExpectancy: number | null;
  shortExpectancy: number | null;
}

/** Filled trades: TP, SL, or still open at expiry (marked to market). Unfilled orders cost nothing. */
export function isRealized(row: TradeRow): boolean {
  return row.realizedReal !== null;
}

export function metricsOf(rows: TradeRow[]): Metrics {
  const closed = rows.filter(isRealized);
  const wins = closed.filter((r) => r.status === "WIN");
  const losses = closed.filter((r) => r.status === "LOSS");
  const rOf = (r: TradeRow) => r.realizedReal ?? 0;
  const grossWin = closed.reduce((s, r) => s + Math.max(0, rOf(r)), 0);
  const grossLoss = closed.reduce((s, r) => s + Math.max(0, -rOf(r)), 0);
  const sumR = closed.reduce((s, r) => s + rOf(r), 0);
  let equity = 0;
  let peak = 0;
  let maxDd = 0;
  for (const r of [...closed].sort((a, b) => a.t - b.t)) {
    equity += rOf(r);
    peak = Math.max(peak, equity);
    maxDd = Math.max(maxDd, peak - equity);
  }
  const long = closed.filter((r) => r.direction === "LONG");
  const short = closed.filter((r) => r.direction === "SHORT");
  const side = (xs: TradeRow[]) => {
    if (!xs.length) return { wr: null as number | null, exp: null as number | null };
    const w = xs.filter((r) => r.status === "WIN").length;
    return { wr: w / xs.length, exp: xs.reduce((s, r) => s + rOf(r), 0) / xs.length };
  };
  const L = side(long);
  const S = side(short);
  return {
    trades: closed.length,
    wins: wins.length,
    losses: losses.length,
    winRate: closed.length ? wins.length / closed.length : null,
    expectancy: closed.length ? sumR / closed.length : null,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : null,
    maxDrawdownR: maxDd,
    averageR: closed.length ? sumR / closed.length : null,
    longTrades: long.length,
    shortTrades: short.length,
    longWinRate: L.wr,
    shortWinRate: S.wr,
    longExpectancy: L.exp,
    shortExpectancy: S.exp,
  };
}

export function improves(base: Metrics, next: Metrics): boolean {
  if (next.trades < 20) return false;
  if (base.expectancy === null || next.expectancy === null) return false;
  if (base.profitFactor === null || next.profitFactor === null) return false;
  return next.expectancy > base.expectancy && next.profitFactor > base.profitFactor;
}

export function acceptance(m: Metrics): boolean {
  return (
    m.trades >= 30 &&
    m.expectancy !== null &&
    m.expectancy > 0 &&
    m.profitFactor !== null &&
    m.profitFactor >= 1.2
  );
}
