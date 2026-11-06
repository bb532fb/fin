# Crypto AI Analyst

Technical market analysis for crypto pairs: LONG / SHORT / NO TRADE, signal confidence (0–100),
risk level, entry zone, stop loss, take profit and an AI explanation.

> Crypto AI Analyst provides analytical information only and does not guarantee trading results.
> Cryptocurrency trading involves significant financial risk.

## Stack

Next.js 16 (App Router, Turbopack) · TypeScript strict · Tailwind CSS 4 · PostgreSQL · Prisma 7
(driver adapter `@prisma/adapter-pg`) · Zod 4 · OpenAI Responses API (Structured Outputs) ·
Binance public market data · Vitest.

## Getting started

```bash
cp .env.example .env          # fill OPENAI_API_KEY (optional, see below)
docker compose up -d          # local PostgreSQL on port 5433
npm install                   # also runs `prisma generate`
npm run db:migrate            # apply migrations
npm run dev                   # http://localhost:3000
```

Quality gate: `npm run check` (typecheck + lint + tests) and `npm run build`.
Production database: `npm run db:deploy` (never `db:migrate` against production).

Without `OPENAI_API_KEY` the app works fully; explanations are generated from rules instead of AI.

## Analysis pipeline

```
POST /api/analyze {symbol, timeframe}
  → rate limit (per IP)  → Zod validation
  → services/binance.ts      500 candles; the in-progress candle is excluded from indicators
  → lib/indicators/*         RSI, EMA20/50/200, MACD, ATR, volume change, pivots S/R, range break
  → lib/signal/conditions    16 mirrored bull/bear conditions with weights
  → lib/signal/scoring       confidence = dominant − 0.5 × opposing (0–100)
  → lib/signal-engine.ts     filters → NO_TRADE: weak, mixed, trend/HTF conflict, RSI extreme, poor R/R
  → lib/signal/risk.ts       entry / SL / TP from structure + ATR, tick-rounded conservatively
  → services/ai.ts           explains computed facts only; guardrails; rule-based fallback
  → Zod response contract    (rejects inconsistent levels) → PostgreSQL → UI
```

Key rules (all in `lib/config/trading.ts`):

- Minimum confidence 60, minimum bull/bear margin 25, minimum risk/reward 1.5.
- Higher-timeframe trend must not oppose the signal (e.g. 15m vs 1h); setup quality A/B/C ranks conviction.
- No LONG at RSI ≥ 75, no SHORT at RSI ≤ 25.
- Stop distance between 1 and 3 ATR; R/R is computed from the worst entry in the zone and rounded down.
- The AI never sees raw candles and cannot change direction, confidence or levels. Output with
  numbers not present in the input, or with claims like "guaranteed"/"100%", is discarded.

**Any change to indicators, weights, thresholds or risk rules must bump `ENGINE_VERSION`**, so that
stored history and future win-rate statistics are never mixed across logic versions.

## Project structure

```
app/                    pages (dashboard, history, about) and /api/analyze
components/ui           reusable primitives (Card, Button, Badge, Stat, SelectField)
components/analyzer     analyzer form, result card and its sections
components/history      history table and pagination
lib/indicators          pure indicator math (unit tested)
lib/signal              conditions, scoring, risk plan, tick rounding (unit tested)
lib/signal-engine.ts    pure, deterministic engine entry point
lib/ai                  AI facts, output schema, guardrails, rule-based fallback
lib/schemas             Zod API contract (shared by server and browser)
services/               I/O: Binance, OpenAI, Prisma repository, analysis orchestrator
prisma/                 schema and migrations
```

## Extension points

| Future feature | Where it plugs in |
| --- | --- |
| Authentication, plans, free limits | `Analysis.userId`; rate-limit key in `app/api/analyze/route.ts` |
| Shared rate limiting (multi-instance) | Implement `RateLimiter` (`lib/rate-limit.ts`) with Redis |
| Binance WebSocket / other exchanges | Implement `MarketDataProvider` (`types/market.ts`) |
| Multiple AI models | Implement `ExplanationProvider` (`services/ai.ts`) |
| Scheduled outcome tracking | Call `outcomeTracker.trackPending()` (`services/outcome-tracker.ts`) from a cron route |
| Backtesting / historical win rate | Run `evaluateMarket()` over historical candle windows; group by `engineVersion` |
| Alerts (Telegram, email) | Call `analysisService.analyze()` from a scheduled job |

## Outcome tracking, guidance and scanner

- **Outcome tracking**: each `/history` load replays pending LONG/SHORT signals on finer Binance
  candles (`lib/tracking/resolve-outcome.ts`, throttled to once a minute). Ambiguity resolves
  pessimistically: a candle touching stop and target is a LOSS; the entry candle can only lose.
  Win rate and expectancy (R) are shown per `engineVersion`, before fees.
- **Action guide** (Armenian): spot-only instructions per result (`lib/guidance/action-guide.ts`).
  SHORT and HIGH-risk LONG are never presented as actionable.
- **Position calculator**: risk-based size with fees, floored to the `LOT_SIZE` step and capped by
  capital (`lib/trading/position-size.ts`).
- **Scanner** (`POST /api/scan`): engine-only pass over all pairs (no AI, not persisted); acting
  on a pair runs the full analysis so the signal is stored and tracked.

## Operational notes

- `data-api.binance.vision` is used because `api.binance.com` blocks some cloud regions (HTTP 451).
- The in-memory rate limiter and 30 s result cache are per process. Use a shared store before scaling out.
- `X-Forwarded-For` is trusted for the rate-limit key; deploy behind a proxy that overwrites it.
- Confidence is a measure of indicator agreement, not a calibrated probability. Validate the engine
  with outcome tracking/backtesting before relying on it for real capital.
