import "server-only";
import { buildAnalysisFacts } from "@/lib/ai/facts";
import { buildAnalysisResult } from "@/lib/analysis/build-result";
import { isForexSymbol } from "@/lib/config/market";
import type { MarketVenue } from "@/lib/config/market";
import { AppError, describeError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { loadMarketWithHtf } from "@/lib/market/with-htf";
import { analysisResultSchema } from "@/lib/schemas/analysis";
import { evaluateMarket } from "@/lib/signal-engine";
import { TtlCache } from "@/lib/ttl-cache";
import { openAiExplanationProvider } from "@/services/ai";
import type { ExplanationProvider } from "@/services/ai";
import { prismaAnalysisRepository } from "@/services/analysis-repository";
import type { AnalysisRepository } from "@/services/analysis-repository";
import { binanceFuturesMarketData, binanceMarketData } from "@/services/binance";
import { forexMarketData } from "@/services/forex";
import type { AnalysisResult, AnalyzeRequest } from "@/types/analysis";
import type { MarketDataProvider, MarketSnapshot } from "@/types/market";
import type { EngineResult, Trend } from "@/types/signal";

/** Identical requests within this window reuse one result (saves AI cost, prevents duplicate rows). */
const RESULT_CACHE_TTL_MS = 30_000;

/** Callers may omit `market`; missing means spot, so older clients keep working. */
export type AnalyzeCommand = Omit<AnalyzeRequest, "market"> & { market?: MarketVenue };

export interface AnalysisServiceDeps {
  marketData: MarketDataProvider;
  futuresMarketData?: MarketDataProvider;
  forexMarketData?: MarketDataProvider;
  explainer: ExplanationProvider;
  repository: AnalysisRepository;
}

function venueOf(request: AnalyzeCommand): MarketVenue {
  return request.market ?? "spot";
}

function marketDataFor(
  deps: AnalysisServiceDeps,
  venue: MarketVenue,
  symbol: AnalyzeCommand["symbol"],
): MarketDataProvider {
  if (isForexSymbol(symbol)) {
    if (!deps.forexMarketData) {
      throw new AppError("INTERNAL_ERROR", "Արտարժույթի տվյալները կարգավորված չեն։");
    }
    return deps.forexMarketData;
  }
  if (venue === "futures") {
    if (!deps.futuresMarketData) {
      throw new AppError("INTERNAL_ERROR", "Futures շուկայի տվյալները կարգավորված չեն։");
    }
    return deps.futuresMarketData;
  }
  // Spot and Pocket Option crypto both read the real Binance spot book.
  // Pocket Option does not publish its OTC prices.
  return deps.marketData;
}

function runEngine(
  market: MarketSnapshot,
  request: AnalyzeCommand,
  higherTrend: Trend | null,
): EngineResult {
  try {
    return evaluateMarket(market, { higherTrend });
  } catch (error) {
    logger.error("engine_failed", { ...request, error: describeError(error) });
    throw new AppError("INSUFFICIENT_DATA", "Շուկայի տվյալները բավարար չեն հուսալի վերլուծության համար։", {
      cause: error,
    });
  }
}

async function persist(
  repository: AnalysisRepository,
  result: AnalysisResult,
  market: MarketVenue,
): Promise<string | null> {
  try {
    return await repository.save(result, market);
  } catch (error) {
    logger.error("analysis_save_failed", {
      symbol: result.symbol,
      timeframe: result.timeframe,
      error: describeError(error),
    });
    return null;
  }
}

export function createAnalysisService(deps: AnalysisServiceDeps) {
  const cache = new TtlCache<AnalysisResult>(RESULT_CACHE_TTL_MS);
  const inFlight = new Map<string, Promise<AnalysisResult>>();

  async function run(request: AnalyzeCommand): Promise<AnalysisResult> {
    const venue = venueOf(request);
    const { market, higherTimeframe, higherTrend } = await loadMarketWithHtf(
      marketDataFor(deps, venue, request.symbol),
      request.symbol,
      request.timeframe,
    );
    const engine = runEngine(market, request, higherTrend);
    const facts = buildAnalysisFacts(engine, {
      symbol: request.symbol,
      timeframe: request.timeframe,
      livePrice: market.livePrice,
      filters: market.filters,
      higherTimeframe,
      higherTrend,
    });
    const explanation = await deps.explainer.explain(facts);
    const draft = buildAnalysisResult(engine, explanation, {
      ...request,
      market,
      higherTimeframe,
      higherTrend,
      createdAt: new Date(),
    });

    const validated = analysisResultSchema.safeParse(draft);
    if (!validated.success) {
      logger.error("analysis_contract_violation", { ...request, issues: validated.error.message });
      throw new AppError("INTERNAL_ERROR", "Վերլուծությունը չհաջողվեց անվտանգ ավարտել։ Փորձիր նորից։");
    }
    const id = await persist(deps.repository, validated.data, venue);
    return { ...validated.data, id };
  }

  async function analyze(request: AnalyzeCommand): Promise<AnalysisResult> {
    const key = `${venueOf(request)}:${request.symbol}:${request.timeframe}`;
    const cached = cache.get(key);
    if (cached) return cached;

    const pending = inFlight.get(key);
    if (pending) return pending;

    const promise = run(request).finally(() => inFlight.delete(key));
    inFlight.set(key, promise);
    const result = await promise;
    cache.set(key, result);
    return result;
  }

  return { analyze };
}

export const analysisService = createAnalysisService({
  marketData: binanceMarketData,
  futuresMarketData: binanceFuturesMarketData,
  forexMarketData,
  explainer: openAiExplanationProvider,
  repository: prismaAnalysisRepository,
});
