import { describe, expect, it, vi } from "vitest";
import { buildRuleBasedExplanation } from "@/lib/ai/fallback";
import { analysisResultSchema } from "@/lib/schemas/analysis";
import { createAnalysisService } from "@/services/analysis";
import type { AnalysisServiceDeps } from "@/services/analysis";
import { candlesFromCloses } from "@/tests/helpers/candles";
import type { MarketSnapshot } from "@/types/market";

function uptrendMarket(): MarketSnapshot {
  const closes = Array.from(
    { length: 300 },
    (_, i) => 100 + 0.3 * i + 6 * Math.sin((2 * Math.PI * i) / 24),
  );
  return {
    candles: candlesFromCloses(closes, { wick: 0.4 }),
    livePrice: closes.at(-1) as number,
    filters: { tickSize: 0.01, pricePrecision: 2, quantityStep: 0.00001, minNotional: 5 },
  };
}

function deps(overrides: Partial<AnalysisServiceDeps> = {}): AnalysisServiceDeps {
  return {
    marketData: { getMarketSnapshot: vi.fn(async () => uptrendMarket()) },
    explainer: { explain: vi.fn(async (facts) => buildRuleBasedExplanation(facts)) },
    repository: { save: vi.fn(async () => "analysis_1") },
    ...overrides,
  };
}

const request = { symbol: "BTCUSDT", timeframe: "15m" } as const;

describe("analysis service", () => {
  it("returns a contract-valid result with the saved id", async () => {
    const result = await createAnalysisService(deps()).analyze(request);
    expect(analysisResultSchema.safeParse(result).success).toBe(true);
    expect(result.id).toBe("analysis_1");
    expect(result.direction).toBe("LONG");
  });

  it("still returns the analysis when persistence fails", async () => {
    const failing = deps({ repository: { save: vi.fn(async () => Promise.reject(new Error("db down"))) } });
    const result = await createAnalysisService(failing).analyze(request);
    expect(result.id).toBeNull();
  });

  it("deduplicates concurrent and repeated identical requests", async () => {
    const d = deps();
    const service = createAnalysisService(d);
    await Promise.all([service.analyze(request), service.analyze(request)]);
    await service.analyze(request);
    // One fetch for the chart timeframe and one for its higher timeframe.
    expect(d.marketData.getMarketSnapshot).toHaveBeenCalledTimes(2);
    expect(d.repository.save).toHaveBeenCalledTimes(1);
  });

  it("stores a futures analysis separately from the spot candle feed", async () => {
    const spot = { getMarketSnapshot: vi.fn(async () => uptrendMarket()) };
    const futures = { getMarketSnapshot: vi.fn(async () => uptrendMarket()) };
    const repository = { save: vi.fn(async () => "analysis_1") };
    const result = await createAnalysisService(
      deps({ marketData: spot, futuresMarketData: futures, repository }),
    ).analyze({ symbol: "BTCUSDT", timeframe: "5m", market: "futures" });

    expect(futures.getMarketSnapshot).toHaveBeenCalled();
    expect(spot.getMarketSnapshot).not.toHaveBeenCalled();
    expect(repository.save).toHaveBeenCalledWith(expect.anything(), "futures");
    expect(result.id).toBe("analysis_1");
    expect(analysisResultSchema.safeParse(result).success).toBe(true);
  });

  it("stores a Pocket Option analysis from real spot candles", async () => {
    const spot = { getMarketSnapshot: vi.fn(async () => uptrendMarket()) };
    const futures = { getMarketSnapshot: vi.fn(async () => uptrendMarket()) };
    const repository = { save: vi.fn(async () => "analysis_1") };
    const result = await createAnalysisService(
      deps({ marketData: spot, futuresMarketData: futures, repository }),
    ).analyze({ symbol: "BTCUSDT", timeframe: "5m", market: "pocket" });

    expect(spot.getMarketSnapshot).toHaveBeenCalled();
    expect(futures.getMarketSnapshot).not.toHaveBeenCalled();
    expect(repository.save).toHaveBeenCalledWith(expect.anything(), "pocket");
    expect(result.id).toBe("analysis_1");
  });

  it("propagates market data errors", async () => {
    const failing = deps({
      marketData: { getMarketSnapshot: vi.fn(async () => Promise.reject(new Error("offline"))) },
    });
    await expect(createAnalysisService(failing).analyze(request)).rejects.toThrow("offline");
  });
});
