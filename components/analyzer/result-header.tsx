import { ConfidenceMeter } from "@/components/analyzer/confidence-meter";
import { MiniCandleChart } from "@/components/analyzer/mini-candle-chart";
import { Badge, TONE_TEXT } from "@/components/ui/badge";
import { CoinIcon } from "@/components/ui/icons";
import { formatSymbolPair, openForMinutes, tradeDurationText } from "@/lib/config/market";
import type { MarketVenue } from "@/lib/config/market";
import { formatDateTime, formatSignedPercent, humanize } from "@/lib/format";
import {
  DIRECTION_LABEL,
  DIRECTION_SUBTITLE,
  DIRECTION_TONE,
  RISK_TONE,
  SETUP_QUALITY_TONE,
  TREND_TONE,
} from "@/lib/presentation";
import type { AnalysisResult } from "@/types/analysis";

function HeaderMeta({ result, venue }: { result: AnalysisResult; venue: MarketVenue }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <CoinIcon className="text-caution" />
      <span className="font-semibold text-text">{formatSymbolPair(result.symbol)}</span>
      <Badge tone="accent">
        {venue === "pocket" ? "Pocket Option" : venue === "futures" ? "Futures" : "Spot"}
      </Badge>
      {venue === "pocket" && <Badge tone="muted">Ոչ OTC</Badge>}
      <Badge tone="muted">
        {venue === "spot" ? result.timeframe : tradeDurationText(result.timeframe)}
      </Badge>
      <Badge tone={TREND_TONE[result.trend]}>Trend՝ {humanize(result.trend)}</Badge>
      {result.higherTimeframe && result.higherTrend && (
        <Badge tone={TREND_TONE[result.higherTrend]}>
          {result.higherTimeframe}՝ {humanize(result.higherTrend)}
        </Badge>
      )}
      <Badge tone="accent">
        {result.analysis.source === "AI" ? "AI վերլուծություն" : "Կանոնների վերլուծություն"}
      </Badge>
      <span className="ml-auto text-xs text-subtle">
        Վերջին թարմացում՝ {formatDateTime(result.createdAt)}
      </span>
    </div>
  );
}

function SignalBadges({ result }: { result: AnalysisResult }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Badge tone={result.priceChangePct >= 0 ? "long" : "short"}>
        {formatSignedPercent(result.priceChangePct)}
      </Badge>
      {result.setupQuality && (
        <Badge tone={SETUP_QUALITY_TONE[result.setupQuality]}>Setup՝ {result.setupQuality}</Badge>
      )}
      <Badge tone="muted">Signal՝ {humanize(result.signalStrength)}</Badge>
      {result.direction !== "NO_TRADE" && (
        <Badge tone={RISK_TONE[result.risk]}>Ռիսկ՝ {humanize(result.risk)}</Badge>
      )}
    </div>
  );
}

function timedHeadline(result: AnalysisResult, venue: MarketVenue): { label: string; subtitle: string } {
  if (result.direction === "NO_TRADE") {
    return {
      label: DIRECTION_LABEL.NO_TRADE,
      subtitle:
        venue === "pocket"
          ? "Pocket Option-ում այս րոպեով մի դիր։"
          : "Այս գրաֆիկով հիմա րոպե մի դիր։",
    };
  }
  const instruction = openForMinutes(result.direction, result.timeframe);
  return {
    label: result.direction === "LONG" ? "ՎԵՐԵՎ" : "ՆԵՐՔԵՎ",
    subtitle: venue === "pocket" ? `Ոչ OTC։ ${instruction}` : instruction,
  };
}

export function ResultHeader({ result, venue }: { result: AnalysisResult; venue: MarketVenue }) {
  const tone = DIRECTION_TONE[result.direction];
  const timed = venue === "spot" ? null : timedHeadline(result, venue);
  return (
    <div className="flex flex-col gap-6">
      <HeaderMeta result={result} venue={venue} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,420px)] lg:items-start">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <p
              className={`text-4xl font-black tracking-tight drop-shadow-[0_0_28px_currentColor] sm:text-5xl ${TONE_TEXT[tone]}`}
            >
              {timed ? timed.label : DIRECTION_LABEL[result.direction]}
            </p>
            <p className={timed ? "text-lg font-semibold text-text" : "text-sm text-muted"}>
              {timed ? timed.subtitle : DIRECTION_SUBTITLE[result.direction]}
            </p>
          </div>
          <SignalBadges result={result} />
          <ConfidenceMeter confidence={result.confidence} strength={result.signalStrength} />
        </div>
        <MiniCandleChart result={result} />
      </div>
    </div>
  );
}
