import { ActionGuide } from "@/components/analyzer/action-guide";
import { AiAnalysis } from "@/components/analyzer/ai-analysis";
import { ConditionList } from "@/components/analyzer/condition-list";
import { IndicatorGrid } from "@/components/analyzer/indicator-grid";
import { NoTradeNotice } from "@/components/analyzer/no-trade-notice";
import { ResultHeader } from "@/components/analyzer/result-header";
import { TradeLevels } from "@/components/analyzer/trade-levels";
import { Card, CardTitle } from "@/components/ui/card";
import { ClockIcon, CpuIcon, PulseIcon, ServerIcon } from "@/components/ui/icons";
import { openForMinutes } from "@/lib/config/market";
import type { MarketVenue } from "@/lib/config/market";
import { formatDateTime } from "@/lib/format";
import type { AnalysisResult } from "@/types/analysis";

function ResultMeta({ result, venue }: { result: AnalysisResult; venue: MarketVenue }) {
  return (
    <Card as="div" className="flex flex-col gap-3 px-5 py-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted">
        <span className="flex items-center gap-2">
          <ClockIcon width={14} height={14} />
          Վերջին թարմացում՝ {formatDateTime(result.createdAt)}
        </span>
        <span className="flex items-center gap-2">
          <ServerIcon width={14} height={14} />
          Աղբյուր՝{" "}
          {venue === "pocket"
            ? "Իրական շուկա · Binance (Pocket Option ոչ OTC)"
            : venue === "futures"
              ? "Binance Futures"
              : "Binance Spot"}
        </span>
        <span className="flex items-center gap-2">
          <CpuIcon width={14} height={14} />
          Engine v{result.engineVersion}
        </span>
        <span className="font-semibold text-text sm:ml-auto">Crypto AI Analyst</span>
      </div>
      <p className="text-xs leading-relaxed text-subtle">{result.disclaimer}</p>
    </Card>
  );
}

export function ResultCard({ result, venue }: { result: AnalysisResult; venue: MarketVenue }) {
  return (
    <div className="flex flex-col gap-5 animate-fade-up-delay">
      <Card as="article" className="p-6 sm:p-7">
        <ResultHeader result={result} venue={venue} />
      </Card>

      <Card className="p-6 sm:p-7">
        <ActionGuide result={result} venue={venue} />
      </Card>

      {venue === "pocket" && result.direction !== "NO_TRADE" ? (
        <Card className="p-6 sm:p-7">
          <CardTitle>Pocket Option · ոչ OTC</CardTitle>
          <p className="text-sm leading-relaxed text-muted">
            {openForMinutes(result.direction, result.timeframe)}։
            Գործարքը փակվում է այդ ժամանակի վերջում։ Take profit և Stop loss այս հարթակում չեն կիրառվում։
          </p>
        </Card>
      ) : result.direction === "NO_TRADE" ? (
        <Card className="flex flex-col gap-4 p-6 sm:p-7">
          <CardTitle>Շուկայի մակարդակներ</CardTitle>
          <NoTradeNotice result={result} />
        </Card>
      ) : (
        <TradeLevels result={result} />
      )}

      <Card className="flex flex-col gap-5 p-6 sm:p-7">
        <div className="flex items-center gap-2 text-text">
          <PulseIcon className="text-accent-glow" />
          <h2 className="font-semibold">Տեխնիկական ցուցանիշներ</h2>
        </div>
        <IndicatorGrid result={result} />
      </Card>

      <ConditionList conditions={result.conditions} />

      <Card className="border-violet/30 bg-[linear-gradient(135deg,rgb(124_92_255_/_0.14),rgb(16_28_46_/_0.88)_48%,rgb(34_211_238_/_0.08))] p-6 sm:p-7">
        <AiAnalysis analysis={result.analysis} result={result} />
      </Card>

      <ResultMeta result={result} venue={venue} />
    </div>
  );
}
