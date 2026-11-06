import type { Metadata } from "next";
import { Suspense } from "react";
import { z } from "zod";
import { HistoryFilters } from "@/components/history/history-filters";
import type { HistoryQuery } from "@/components/history/history-filters";
import { HistoryTable } from "@/components/history/history-table";
import { OutcomeBreakdownCard } from "@/components/history/outcome-breakdown";
import { Pagination } from "@/components/history/pagination";
import { PerformanceSummary } from "@/components/history/performance-summary";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { MARKETS } from "@/lib/config/market";
import type { MarketVenue } from "@/lib/config/market";
import { ENGINE_VERSION } from "@/lib/config/trading";
import {
  getOutcomeBreakdown,
  getPerformanceStats,
  listAnalyses,
  type HistoryListFilter,
} from "@/services/analysis-repository";
import { outcomeTracker } from "@/services/outcome-tracker";

export const metadata: Metadata = { title: "Պատմություն" };

const PAGE_SIZE = 25;
const pageSchema = z.coerce.number().int().min(1).max(10_000).catch(1);
const statusSchema = z.enum(["WIN", "LOSS", "PENDING", "EXPIRED", "TRADES"]).optional().catch(undefined);
const directionSchema = z.enum(["LONG", "SHORT"]).optional().catch(undefined);
const minConfidenceSchema = z.coerce.number().int().min(55).max(100).optional().catch(undefined);
const marketSchema = z.enum(MARKETS).optional().catch(undefined);

const MARKET_LABEL: Record<MarketVenue, string> = {
  spot: "Spot",
  futures: "Futures",
  pocket: "Pocket Option",
};

function toListFilter(query: HistoryQuery): HistoryListFilter {
  const status = statusSchema.parse(query.status);
  const direction = directionSchema.parse(query.direction);
  const minConfidence = minConfidenceSchema.parse(query.minConfidence);
  const market = marketSchema.parse(query.market);
  return {
    ...(status ? { status } : {}),
    ...(direction ? { direction } : {}),
    ...(minConfidence !== undefined ? { minConfidence } : {}),
    ...(market ? { market } : {}),
  };
}

async function HistoryContent({ searchParams }: { searchParams: PageProps<"/history">["searchParams"] }) {
  const params = await searchParams;
  const page = pageSchema.parse(params.page);
  const query: HistoryQuery = {
    status: typeof params.status === "string" ? params.status : undefined,
    direction: typeof params.direction === "string" ? params.direction : undefined,
    minConfidence: typeof params.minConfidence === "string" ? params.minConfidence : undefined,
    market: typeof params.market === "string" ? params.market : undefined,
  };
  const filter = toListFilter(query);

  await outcomeTracker.trackPending();
  const [{ items, total }, stats, breakdown] = await Promise.all([
    listAnalyses(page, PAGE_SIZE, filter),
    getPerformanceStats(ENGINE_VERSION, filter.market ?? "spot"),
    getOutcomeBreakdown(ENGINE_VERSION, filter.market ?? "spot"),
  ]);

  if (
    items.length === 0 &&
    page === 1 &&
    !query.status &&
    !query.direction &&
    !query.minConfidence &&
    !query.market
  ) {
    return (
      <Card as="div" className="p-8 text-center text-muted">
        Դեռ վերլուծություն չկա։ Առաջինը արա Վահանակից։
      </Card>
    );
  }

  return (
    <>
      <PerformanceSummary stats={stats} marketLabel={filter.market ? MARKET_LABEL[filter.market] : "Spot"} />
      <OutcomeBreakdownCard breakdown={breakdown} />
      <HistoryFilters query={query} />
      <Card className="overflow-hidden">
        {items.length === 0 ? (
          <p className="p-8 text-center text-muted">Այս ֆիլտրով արդյունք չկա։</p>
        ) : (
          <>
            <HistoryTable items={items} />
            <Pagination page={page} totalPages={Math.ceil(total / PAGE_SIZE)} query={query} />
          </>
        )}
      </Card>
    </>
  );
}

export default function HistoryPage({ searchParams }: PageProps<"/history">) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Վերլուծությունների պատմություն</h1>
        <p className="text-muted">
          Ամեն վերլուծություն պահվում է։ Վերև/ներքև signal-ները ավտոմատ ստուգվում են Binance-ի
          իրական գներով։ Ֆիլտրով տես՝ որոնք են Հաղթ, որոնք՝ Պարտ, և որ խմբերն են ավելի լավ աշխատում։
        </p>
      </div>
      <Suspense
        fallback={
          <Card className="flex items-center justify-center gap-2 p-8 text-muted">
            <Spinner /> Պատմությունը բեռնվում է…
          </Card>
        }
      >
        <HistoryContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
