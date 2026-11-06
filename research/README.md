# Research workflow (production untouched)

Chronological **60% TRAIN / 20% VALIDATION / 20% TEST** research harness for the deterministic signal engine.

## Run

```bash
pnpm exec vitest run research/run-research.test.ts
```

Report is written to `%TEMP%\fin-research-report.json`.

## Rules

- Uses production `evaluateMarket()` + `resolveOutcome` (no threshold edits).
- Metrics are **REALISTIC** (0.10% fee + 0.05% slip per side).
- TEST is sealed until one final candidate evaluation.
- Promote to production only if TEST passes acceptance (EXP > 0, PF ≥ 1.2, enough trades, not one-month luck).
