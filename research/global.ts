/**
 * Pooled study across every symbol/timeframe. A gate picked on one combo is easily luck
 * (many comparisons); a gate must improve the pooled TRAIN and VALIDATION to be considered.
 */
import {
  acceptance,
  metricsOf,
  simulateCombo,
  type ComboBundle,
  type Gate,
  type Metrics,
  type SplitName,
  type TradeRow,
} from "@/research/core";

export interface NamedGate {
  id: string;
  description: string;
  gate: Gate | null;
}

const MIN_TRAIN_TRADES = 100;
const MIN_VALIDATION_TRADES = 30;
const MIN_TEST_TRADES = 50;

function pooledTrades(bundles: readonly ComboBundle[], gate: Gate | null, includeTest: boolean): TradeRow[] {
  return bundles.flatMap((bundle) => simulateCombo(bundle, gate, { includeTest }));
}

function splitMetrics(trades: readonly TradeRow[], split: SplitName): Metrics {
  return metricsOf(trades.filter((t) => t.split === split));
}

function qualifies(train: Metrics, validation: Metrics, baseline: { train: Metrics; validation: Metrics }) {
  return (
    train.trades >= MIN_TRAIN_TRADES &&
    validation.trades >= MIN_VALIDATION_TRADES &&
    (train.expectancy ?? -1) > Math.max(0, baseline.train.expectancy ?? 0) &&
    (validation.expectancy ?? -1) > Math.max(0, baseline.validation.expectancy ?? 0)
  );
}

/** Conservative score: the weaker of the two in-sample splits. */
function score(train: Metrics, validation: Metrics): number {
  return Math.min(train.expectancy ?? -1, validation.expectancy ?? -1);
}

export function runGlobalStudy(bundles: readonly ComboBundle[], gates: readonly NamedGate[]) {
  const baseTrades = pooledTrades(bundles, null, false);
  const baseline = { train: splitMetrics(baseTrades, "TRAIN"), validation: splitMetrics(baseTrades, "VALIDATION") };

  const rows = gates.map(({ id, description, gate }) => {
    const trades = pooledTrades(bundles, gate, false);
    const train = splitMetrics(trades, "TRAIN");
    const validation = splitMetrics(trades, "VALIDATION");
    return { id, description, gate, TRAIN: train, VALIDATION: validation, qualifies: qualifies(train, validation, baseline) };
  });

  const best = rows
    .filter((r) => r.qualifies)
    .sort((a, b) => score(b.TRAIN, b.VALIDATION) - score(a.TRAIN, a.VALIDATION))[0];

  const baselineTest = splitMetrics(pooledTrades(bundles, null, true), "TEST");
  const candidateTest = best ? splitMetrics(pooledTrades(bundles, best.gate, true), "TEST") : null;

  return {
    baseline: { ...baseline, TEST: baselineTest, acceptedOnTest: acceptance(baselineTest) && baselineTest.trades >= MIN_TEST_TRADES },
    experiments: rows.map((r) => ({
      id: r.id,
      description: r.description,
      TRAIN: r.TRAIN,
      VALIDATION: r.VALIDATION,
      qualifies: r.qualifies,
    })),
    candidate: best
      ? {
          id: best.id,
          description: best.description,
          TEST: candidateTest,
          acceptedOnTest:
            candidateTest !== null && acceptance(candidateTest) && candidateTest.trades >= MIN_TEST_TRADES,
        }
      : null,
  };
}
