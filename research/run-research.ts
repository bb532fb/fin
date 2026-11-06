/**
 * Research workflow runner. Production engine untouched.
 * Run: pnpm exec vitest run research/run-research.test.ts
 */
import fs from "node:fs";
import {
  acceptance,
  chronologicalSplits,
  improves,
  isRealized,
  loadCombo,
  metricsOf,
  simulateCombo,
  type ComboBundle,
  type Gate,
  type Metrics,
  type TradeRow,
} from "@/research/core";
import { runGlobalStudy, type NamedGate } from "@/research/global";
import type { SupportedSymbol, Timeframe } from "@/lib/config/market";
import { binanceMarketData } from "@/services/binance";

const SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT"] as const;
const TIMEFRAMES = ["15m", "1h", "4h"] as const;
const OUT = `${process.env.TEMP}\\fin-research-report.json`;

type Experiment = { id: string; description: string; gate: Gate };

function bySplit(trades: TradeRow[], split: TradeRow["split"]) {
  return metricsOf(trades.filter((t) => t.split === split));
}

function conditionAttribution(trades: TradeRow[]) {
  const rows = trades.filter(isRealized);
  const ids = new Set<string>();
  for (const t of rows) for (const c of t.conditions) ids.add(c.id);

  const out = [];
  for (const id of [...ids].sort()) {
    const withC = rows.filter((t) => t.conditions.some((c) => c.id === id && c.met));
    const withoutC = rows.filter((t) => {
      const cond = t.conditions.find((c) => c.id === id);
      return cond ? !cond.met : true;
    });
    const mWith = metricsOf(withC);
    const mWithout = metricsOf(withoutC);
    out.push({
      id,
      presentTrades: mWith.trades,
      winsWhenPresent: mWith.wins,
      lossesWhenPresent: mWith.losses,
      winRateWhenPresent: mWith.winRate,
      expectancyWhenPresent: mWith.expectancy,
      pfWhenPresent: mWith.profitFactor,
      expectancyWhenAbsent: mWithout.expectancy,
      pfWhenAbsent: mWithout.profitFactor,
      absentTrades: mWithout.trades,
      deltaExpectancy:
        mWith.expectancy !== null && mWithout.expectancy !== null
          ? mWith.expectancy - mWithout.expectancy
          : null,
    });
  }
  return out.sort((a, b) => (b.deltaExpectancy ?? -999) - (a.deltaExpectancy ?? -999));
}

function experimentsFor(symbol: SupportedSymbol, timeframe: Timeframe): Experiment[] {
  const align = (dir: "LONG" | "SHORT", trend: string | null) =>
    trend === null || (dir === "LONG" ? trend === "BULLISH" : trend === "BEARISH");

  const list: Experiment[] = [
    {
      id: "short_only",
      description: "Disable LONG",
      gate: (ctx) => ctx.result.direction === "SHORT",
    },
    {
      id: "long_only",
      description: "Disable SHORT",
      gate: (ctx) => ctx.result.direction === "LONG",
    },
    {
      id: "strict_ema_structure",
      description: "Require price>EMA20>EMA50>EMA200 (or inverse)",
      gate: (ctx) =>
        ctx.result.direction === "LONG" ? ctx.extras.strictBull : ctx.extras.strictBear,
    },
    {
      id: "ema_slope",
      description: "EMA20+EMA50 slope aligned with direction",
      gate: (ctx) =>
        ctx.result.direction === "LONG"
          ? ctx.extras.ema20Slope > 0 && ctx.extras.ema50Slope > 0
          : ctx.extras.ema20Slope < 0 && ctx.extras.ema50Slope < 0,
    },
    {
      id: "rvol_1_2",
      description: "Relative volume > 1.2",
      gate: (ctx) => ctx.extras.rvol > 1.2,
    },
    {
      id: "rvol_1_5",
      description: "Relative volume > 1.5",
      gate: (ctx) => ctx.extras.rvol > 1.5,
    },
    {
      id: "regime_trending",
      description: "Only TRENDING regime",
      gate: (ctx) => ctx.extras.regime === "TRENDING",
    },
    {
      id: "regime_not_high_vol",
      description: "Exclude HIGH_VOL",
      gate: (ctx) => ctx.extras.regime !== "HIGH_VOL",
    },
    {
      id: "conf_ge_70",
      description: "Confidence >= 70",
      gate: (ctx) => ctx.result.confidence >= 70,
    },
    {
      id: "conf_ge_85",
      description: "Confidence >= 85",
      gate: (ctx) => ctx.result.confidence >= 85,
    },
    {
      id: "breakout_only",
      description: "Require range breakout/breakdown met",
      gate: (ctx) => {
        const id = ctx.result.direction === "LONG" ? "range_breakout" : "range_breakdown";
        return ctx.result.conditions.some((c) => c.id === id && c.met);
      },
    },
    {
      id: "macd_aligned",
      description: "Require MACD side condition met",
      gate: (ctx) => {
        const id = ctx.result.direction === "LONG" ? "macd_bullish" : "macd_bearish";
        return ctx.result.conditions.some((c) => c.id === id && c.met);
      },
    },
    {
      id: "cvd5_aligned",
      description: "Net taker flow over 5 candles agrees with direction",
      gate: (ctx) => (ctx.result.direction === "LONG" ? ctx.extras.cvd5 > 0 : ctx.extras.cvd5 < 0),
    },
    {
      id: "cvd20_aligned",
      description: "Net taker flow over 20 candles agrees with direction",
      gate: (ctx) => (ctx.result.direction === "LONG" ? ctx.extras.cvd20 > 0 : ctx.extras.cvd20 < 0),
    },
    {
      id: "cvd_both_aligned",
      description: "Net taker flow over 5 and 20 candles agrees with direction",
      gate: (ctx) =>
        ctx.result.direction === "LONG"
          ? ctx.extras.cvd5 > 0 && ctx.extras.cvd20 > 0
          : ctx.extras.cvd5 < 0 && ctx.extras.cvd20 < 0,
    },
  ];

  if (timeframe === "15m") {
    list.push(
      {
        id: "mtf_1h",
        description: "15m + 1h HTF align",
        gate: (ctx) => align(ctx.result.direction, ctx.htf.trend1h),
      },
      {
        id: "mtf_4h",
        description: "15m + 4h HTF align",
        gate: (ctx) => align(ctx.result.direction, ctx.htf.trend4h),
      },
      {
        id: "mtf_1h_4h",
        description: "15m + 1h + 4h HTF align",
        gate: (ctx) =>
          align(ctx.result.direction, ctx.htf.trend1h) &&
          align(ctx.result.direction, ctx.htf.trend4h),
      },
    );
  }
  if (timeframe === "1h") {
    list.push(
      {
        id: "mtf_4h",
        description: "1h + 4h HTF align",
        gate: (ctx) => align(ctx.result.direction, ctx.htf.trend4h),
      },
      {
        id: "mtf_1d",
        description: "1h + 1d HTF align",
        gate: (ctx) => align(ctx.result.direction, ctx.htf.trend1d),
      },
      {
        id: "mtf_4h_1d",
        description: "1h + 4h + 1d HTF align",
        gate: (ctx) =>
          align(ctx.result.direction, ctx.htf.trend4h) &&
          align(ctx.result.direction, ctx.htf.trend1d),
      },
    );
  }
  if (timeframe === "4h") {
    list.push({
      id: "mtf_1d",
      description: "4h + 1d HTF align",
      gate: (ctx) => align(ctx.result.direction, ctx.htf.trend1d),
    });
  }

  // Combinations suggested by prior backtest (SHORT stronger on some BTC 1h)
  list.push({
    id: "short_only_mtf",
    description: "SHORT only + nearest HTF align",
    gate: (ctx) => {
      if (ctx.result.direction !== "SHORT") return false;
      if (timeframe === "15m") return align("SHORT", ctx.htf.trend1h);
      if (timeframe === "1h") return align("SHORT", ctx.htf.trend4h);
      return align("SHORT", ctx.htf.trend1d);
    },
  });
  list.push({
    id: "long_only_mtf",
    description: "LONG only + nearest HTF align",
    gate: (ctx) => {
      if (ctx.result.direction !== "LONG") return false;
      if (timeframe === "15m") return align("LONG", ctx.htf.trend1h);
      if (timeframe === "1h") return align("LONG", ctx.htf.trend4h);
      return align("LONG", ctx.htf.trend1d);
    },
  });
  list.push({
    id: "strict_plus_slope",
    description: "Strict EMA structure + slope",
    gate: (ctx) => {
      const struct =
        ctx.result.direction === "LONG" ? ctx.extras.strictBull : ctx.extras.strictBear;
      const slope =
        ctx.result.direction === "LONG"
          ? ctx.extras.ema20Slope > 0 && ctx.extras.ema50Slope > 0
          : ctx.extras.ema20Slope < 0 && ctx.extras.ema50Slope < 0;
      return struct && slope;
    },
  });
  list.push({
    id: "trending_strict_slope",
    description: "TRENDING + strict structure + slope",
    gate: (ctx) => {
      if (ctx.extras.regime !== "TRENDING") return false;
      const struct =
        ctx.result.direction === "LONG" ? ctx.extras.strictBull : ctx.extras.strictBear;
      const slope =
        ctx.result.direction === "LONG"
          ? ctx.extras.ema20Slope > 0
          : ctx.extras.ema20Slope < 0;
      return struct && slope;
    },
  });

  void symbol;
  return list;
}

/** Gates defined for every studied timeframe, dispatched by the signal's own timeframe. */
function globalGates(): NamedGate[] {
  const perTimeframe = new Map<Timeframe, Experiment[]>(
    TIMEFRAMES.map((tf) => [tf, experimentsFor("BTCUSDT", tf)]),
  );
  const lists = [...perTimeframe.values()];
  const commonIds = (lists[0] ?? [])
    .map((e) => e.id)
    .filter((id) => lists.every((list) => list.some((e) => e.id === id)));

  return commonIds.map((id) => {
    const byTimeframe = new Map<Timeframe, Gate>();
    for (const [tf, list] of perTimeframe) {
      const found = list.find((e) => e.id === id);
      if (found) byTimeframe.set(tf, found.gate);
    }
    const description = lists[0]?.find((e) => e.id === id)?.description ?? id;
    return { id, description, gate: (ctx) => byTimeframe.get(ctx.timeframe)?.(ctx) ?? false };
  });
}

function andGate(a: Gate, b: Gate): Gate {
  return (ctx) => a(ctx) && b(ctx);
}

function findGate(exps: Experiment[], id: string): Gate | null {
  return exps.find((e) => e.id === id)?.gate ?? null;
}

function monthlyStability(trades: TradeRow[]) {
  const closed = trades.filter(isRealized);
  const map = new Map<string, TradeRow[]>();
  for (const t of closed) {
    const d = new Date(t.t);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(t);
  }
  const months = [...map.keys()].sort().map((m) => {
    const s = metricsOf(map.get(m)!);
    return { month: m, trades: s.trades, expectancy: s.expectancy, pf: s.profitFactor };
  });
  const pos = months.filter((m) => (m.expectancy ?? 0) > 0).length;
  return { months, positiveMonths: pos, totalMonths: months.length };
}

export async function runResearch() {
  const report: Record<string, unknown> = {
    generatedAt: new Date().toISOString(),
    assumptions: {
      feePerSide: 0.001,
      slippagePerSide: 0.0005,
      split: "chronological 60/20/20",
      productionChanged: false,
      openaiUsed: false,
      primaryMetric: "REALISTIC expectancy + PF",
    },
    baseline: [] as unknown[],
    conditionAnalysis: {} as Record<string, unknown>,
    experiments: [] as unknown[],
    candidates: [] as unknown[],
    finalTest: null as unknown,
    comparison: null as unknown,
  };

  const bundles: ComboBundle[] = [];
  for (const symbol of SYMBOLS) {
    for (const timeframe of TIMEFRAMES) {
      console.log(`LOAD ${symbol} ${timeframe}`);
      const filters = (await binanceMarketData.getMarketSnapshot(symbol, timeframe)).filters;
      bundles.push(await loadCombo(symbol, timeframe, filters));
    }
  }

  // 1-2 Baseline TRAIN/VAL only (TEST sealed)
  for (const bundle of bundles) {
    const trades = simulateCombo(bundle, null, { includeTest: false });
    const train = bySplit(trades, "TRAIN");
    const val = bySplit(trades, "VALIDATION");
    const key = `${bundle.symbol}_${bundle.timeframe}`;
    console.log(
      `BASELINE ${key} train n=${train.trades} E=${train.expectancy?.toFixed(3)} PF=${train.profitFactor?.toFixed(2)} | val n=${val.trades} E=${val.expectancy?.toFixed(3)} PF=${val.profitFactor?.toFixed(2)}`,
    );
    (report.baseline as unknown[]).push({
      symbol: bundle.symbol,
      timeframe: bundle.timeframe,
      analyzed: bundle.analyzedIndices.length,
      splits: chronologicalSplits(bundle.analyzedIndices.length),
      TRAIN: train,
      VALIDATION: val,
    });
    (report.conditionAnalysis as Record<string, unknown>)[key] = {
      TRAIN: conditionAttribution(trades.filter((t) => t.split === "TRAIN")),
      VALIDATION: conditionAttribution(trades.filter((t) => t.split === "VALIDATION")),
    };

    const exps = experimentsFor(bundle.symbol, bundle.timeframe);
    const baseTrain = train;
    const baseVal = val;
    const acceptedLocal: { id: string; description: string; TRAIN: Metrics; VALIDATION: Metrics }[] =
      [];

    for (const exp of exps) {
      const gated = simulateCombo(bundle, exp.gate, { includeTest: false });
      const t = bySplit(gated, "TRAIN");
      const v = bySplit(gated, "VALIDATION");
      const okTrain = improves(baseTrain, t) || (acceptance(t) && (t.expectancy ?? -99) > (baseTrain.expectancy ?? -99));
      const okVal = improves(baseVal, v) || (acceptance(v) && (v.expectancy ?? -99) > (baseVal.expectancy ?? -99));
      const pass = okTrain && okVal && (t.expectancy ?? -1) > (baseTrain.expectancy ?? 0) && (v.expectancy ?? -1) > (baseVal.expectancy ?? 0);
      (report.experiments as unknown[]).push({
        symbol: bundle.symbol,
        timeframe: bundle.timeframe,
        id: exp.id,
        description: exp.description,
        TRAIN: t,
        VALIDATION: v,
        improvesTrain: okTrain,
        improvesValidation: okVal,
        acceptedForCombo: pass,
      });
      if (pass) acceptedLocal.push({ id: exp.id, description: exp.description, TRAIN: t, VALIDATION: v });
      console.log(
        `EXP ${key} ${exp.id} train E=${t.expectancy?.toFixed(3)} PF=${t.profitFactor?.toFixed(2)} n=${t.trades} | val E=${v.expectancy?.toFixed(3)} PF=${v.profitFactor?.toFixed(2)} n=${v.trades} | pass=${pass}`,
      );
    }

    // Try stacking top 2 accepted gates if available
    if (acceptedLocal.length >= 2) {
      const a = findGate(exps, acceptedLocal[0]!.id);
      const b = findGate(exps, acceptedLocal[1]!.id);
      if (a && b) {
        const stacked: Experiment = {
          id: `stack_${acceptedLocal[0]!.id}__${acceptedLocal[1]!.id}`,
          description: `Stack ${acceptedLocal[0]!.id} + ${acceptedLocal[1]!.id}`,
          gate: andGate(a, b),
        };
        const gated = simulateCombo(bundle, stacked.gate, { includeTest: false });
        const t = bySplit(gated, "TRAIN");
        const v = bySplit(gated, "VALIDATION");
        const pass =
          (t.expectancy ?? -1) > (baseTrain.expectancy ?? 0) &&
          (v.expectancy ?? -1) > (baseVal.expectancy ?? 0) &&
          (t.profitFactor ?? 0) > (baseTrain.profitFactor ?? 0) &&
          (v.profitFactor ?? 0) > (baseVal.profitFactor ?? 0);
        (report.experiments as unknown[]).push({
          symbol: bundle.symbol,
          timeframe: bundle.timeframe,
          id: stacked.id,
          description: stacked.description,
          TRAIN: t,
          VALIDATION: v,
          improvesTrain: pass,
          improvesValidation: pass,
          acceptedForCombo: pass,
        });
        if (pass) acceptedLocal.push({ id: stacked.id, description: stacked.description, TRAIN: t, VALIDATION: v });
      }
    }

    for (const c of acceptedLocal) {
      (report.candidates as unknown[]).push({
        symbol: bundle.symbol,
        timeframe: bundle.timeframe,
        ...c,
        score:
          (c.VALIDATION.expectancy ?? 0) * 2 +
          (c.TRAIN.expectancy ?? 0) +
          ((c.VALIDATION.profitFactor ?? 0) - 1),
      });
    }

    fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  }

  // Pick global best candidate by validation score among those that improve both splits
  const candidates = (report.candidates as { symbol: string; timeframe: string; id: string; description: string; TRAIN: Metrics; VALIDATION: Metrics; score: number }[])
    .filter((c) => (c.TRAIN.expectancy ?? -1) > 0 || (c.VALIDATION.expectancy ?? -1) > 0)
    .sort((a, b) => b.score - a.score);

  const best = candidates[0] ?? null;
  console.log("BEST_CANDIDATE", best ? `${best.symbol} ${best.timeframe} ${best.id}` : "NONE");

  if (best) {
    const bundle = bundles.find((b) => b.symbol === best.symbol && b.timeframe === best.timeframe)!;
    const exps = experimentsFor(bundle.symbol, bundle.timeframe);
    let gate: Gate | null = findGate(exps, best.id);
    if (!gate && best.id.startsWith("stack_")) {
      const parts = best.id.replace("stack_", "").split("__");
      const g0 = findGate(exps, parts[0]!);
      const g1 = findGate(exps, parts[1]!);
      gate = g0 && g1 ? andGate(g0, g1) : null;
    }

    // Final TEST once
    const baselineAll = simulateCombo(bundle, null, { includeTest: true });
    const candidateAll = simulateCombo(bundle, gate, { includeTest: true });
    const baseTest = bySplit(baselineAll, "TEST");
    const candTest = bySplit(candidateAll, "TEST");
    const baseTrain = bySplit(baselineAll, "TRAIN");
    const candTrain = bySplit(candidateAll, "TRAIN");
    const baseVal = bySplit(baselineAll, "VALIDATION");
    const candVal = bySplit(candidateAll, "VALIDATION");
    const stability = monthlyStability(candidateAll.filter((t) => t.split === "TEST"));
    const accepted = acceptance(candTest) && stability.totalMonths >= 2;

    report.finalTest = {
      candidate: best,
      TEST: candTest,
      baselineTEST: baseTest,
      monthlyTEST: stability,
      acceptedOnTest: accepted,
      note: "TEST used only once; no further parameter changes after this measurement.",
    };

    report.comparison = {
      symbol: best.symbol,
      timeframe: best.timeframe,
      current: {
        TRAIN: { trades: baseTrain.trades, wr: baseTrain.winRate, exp: baseTrain.expectancy, pf: baseTrain.profitFactor, maxDd: baseTrain.maxDrawdownR },
        VALIDATION: { trades: baseVal.trades, wr: baseVal.winRate, exp: baseVal.expectancy, pf: baseVal.profitFactor, maxDd: baseVal.maxDrawdownR },
        TEST: { trades: baseTest.trades, wr: baseTest.winRate, exp: baseTest.expectancy, pf: baseTest.profitFactor, maxDd: baseTest.maxDrawdownR },
      },
      optimized: {
        id: best.id,
        description: best.description,
        TRAIN: { trades: candTrain.trades, wr: candTrain.winRate, exp: candTrain.expectancy, pf: candTrain.profitFactor, maxDd: candTrain.maxDrawdownR },
        VALIDATION: { trades: candVal.trades, wr: candVal.winRate, exp: candVal.expectancy, pf: candVal.profitFactor, maxDd: candVal.maxDrawdownR },
        TEST: { trades: candTest.trades, wr: candTest.winRate, exp: candTest.expectancy, pf: candTest.profitFactor, maxDd: candTest.maxDrawdownR },
      },
    };
  } else {
    report.finalTest = {
      candidate: null,
      acceptedOnTest: false,
      reason: "No experiment improved BOTH train and validation expectancy vs baseline.",
    };
  }

  // Rank helpful conditions globally (train)
  const conditionSummary: Record<string, { deltaSum: number; n: number }> = {};
  for (const [key, val] of Object.entries(report.conditionAnalysis as Record<string, { TRAIN: { id: string; deltaExpectancy: number | null }[] }>)) {
    for (const row of val.TRAIN) {
      if (row.deltaExpectancy === null) continue;
      conditionSummary[row.id] ??= { deltaSum: 0, n: 0 };
      conditionSummary[row.id]!.deltaSum += row.deltaExpectancy;
      conditionSummary[row.id]!.n += 1;
    }
    void key;
  }
  report.conditionRanking = Object.entries(conditionSummary)
    .map(([id, v]) => ({ id, avgDeltaExpectancy: v.deltaSum / v.n, samples: v.n }))
    .sort((a, b) => b.avgDeltaExpectancy - a.avgDeltaExpectancy);

  const global = runGlobalStudy(bundles, globalGates());
  report.global = global;
  const fmt = (m: Metrics | null) =>
    m ? `n=${m.trades} E=${m.expectancy?.toFixed(3)} PF=${m.profitFactor?.toFixed(2)} DD=${m.maxDrawdownR.toFixed(1)}R` : "-";
  console.log(`GLOBAL_BASELINE train ${fmt(global.baseline.train)} | val ${fmt(global.baseline.validation)} | test ${fmt(global.baseline.TEST)}`);
  for (const e of global.experiments) {
    console.log(`GLOBAL_EXP ${e.id} train ${fmt(e.TRAIN)} | val ${fmt(e.VALIDATION)} | qualifies=${e.qualifies}`);
  }
  console.log(`GLOBAL_CANDIDATE ${global.candidate ? `${global.candidate.id} test ${fmt(global.candidate.TEST)} accepted=${global.candidate.acceptedOnTest}` : "NONE"}`);

  const acceptedExps = (report.experiments as { acceptedForCombo: boolean }[]).filter((e) => e.acceptedForCombo);
  report.summary = {
    combos: bundles.length,
    experimentsRun: (report.experiments as unknown[]).length,
    acceptedExperimentPairs: acceptedExps.length,
    bestCandidate: best,
    /** Only the pooled study may justify a production change; single-combo picks are exploratory. */
    promoteToProduction: global.candidate?.acceptedOnTest ?? false,
  };

  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log("REPORT_PATH " + OUT);
  return report;
}
