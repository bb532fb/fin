import { Stat } from "@/components/ui/stat";
import { NO_TRADE_MESSAGE } from "@/lib/config/trading";
import { formatPrice, humanize } from "@/lib/format";
import type { AnalysisResult } from "@/types/analysis";

type NoTradeResult = Extract<AnalysisResult, { direction: "NO_TRADE" }>;

export function NoTradeNotice({ result }: { result: NoTradeResult }) {
  const p = result.pricePrecision;
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-caution/35 bg-caution/10 p-4 shadow-[0_0_20px_rgb(245_185_66_/_0.08)]">
        <p className="font-medium text-caution">{NO_TRADE_MESSAGE}</p>
        <p className="mt-1 text-sm text-muted">{result.noTrade.message}</p>
        <p className="mt-2 text-xs text-subtle">
          Պատճառ՝ {humanize(result.noTrade.code)} · Ուղղության bias՝ {humanize(result.bias)}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Ընթացիկ գին" value={formatPrice(result.price, p)} />
        <Stat label="Մոտակա support" value={formatPrice(result.support, p)} />
        <Stat label="Մոտակա resistance" value={formatPrice(result.resistance, p)} />
      </div>
    </div>
  );
}
