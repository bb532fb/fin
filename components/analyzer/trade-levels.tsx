import type { ReactNode } from "react";
import { TONE_TEXT } from "@/components/ui/badge";
import { IconTile } from "@/components/ui/icon-tile";
import {
  AlertIcon,
  BarrierIcon,
  BarsIcon,
  LayersIcon,
  PulseIcon,
  ShieldIcon,
  TargetIcon,
} from "@/components/ui/icons";
import { Stat } from "@/components/ui/stat";
import { formatPrice, formatRatio } from "@/lib/format";
import type { Tone } from "@/lib/presentation";
import type { TradeAnalysisResult } from "@/types/analysis";

interface LevelStat {
  label: string;
  value: string;
  hint?: string;
  icon: ReactNode;
  tone: Tone;
}

const CARD_TONE: Record<Tone, string> = {
  long: "border-long/35 bg-long/5 shadow-[0_0_24px_rgb(34_227_138_/_0.08)]",
  short: "border-short/35 bg-short/5 shadow-[0_0_24px_rgb(242_85_106_/_0.08)]",
  accent: "border-accent/30 bg-accent/5 shadow-[0_0_24px_rgb(34_211_238_/_0.08)]",
  caution: "border-caution/30 bg-caution/5",
  muted: "border-border/80",
};

function entryDisplay(result: TradeAnalysisResult): string {
  const p = result.pricePrecision;
  if (result.entry.min === result.entry.max) return formatPrice(result.entry.min, p);
  return formatPrice((result.entry.min + result.entry.max) / 2, p);
}

function primaryLevels(result: TradeAnalysisResult): LevelStat[] {
  const p = result.pricePrecision;
  return [
    {
      label: "Մուտքի գին",
      value: entryDisplay(result),
      hint: `${formatPrice(result.entry.min, p)} – ${formatPrice(result.entry.max, p)}`,
      icon: <LayersIcon />,
      tone: "long",
    },
    { label: "Աջակցություն", value: formatPrice(result.support, p), hint: "Մոտակա աջակցություն", icon: <ShieldIcon />, tone: "accent" },
    { label: "Դիմադրություն", value: formatPrice(result.resistance, p), hint: "Մոտակա դիմադրություն", icon: <BarrierIcon />, tone: "short" },
    {
      label: "Stop loss",
      value: formatPrice(result.stopLoss, p),
      hint: result.stopBasis === "STRUCTURE" ? "Կառուցվածքային մակարդակից" : "Անկայունության հիման վրա (ATR)",
      icon: <AlertIcon />,
      tone: "short",
    },
  ];
}

function secondaryLevels(result: TradeAnalysisResult): LevelStat[] {
  const p = result.pricePrecision;
  return [
    {
      label: "Take profit",
      value: formatPrice(result.takeProfit, p),
      hint: result.targetBasis === "STRUCTURE" ? "Մոտ կառուցվածքային" : "Կանխատեսված (մակարդակ չի գտնվել)",
      icon: <TargetIcon />,
      tone: "long",
    },
    { label: "Ներկա գին", value: formatPrice(result.price, p), icon: <PulseIcon />, tone: "accent" },
    { label: "Risk / reward", value: formatRatio(result.riskReward), hint: "Ամենավատ entry-ով", icon: <BarsIcon />, tone: "muted" },
  ];
}

function LevelCard({ stat }: { stat: LevelStat }) {
  return (
    <Stat
      label={stat.label}
      value={stat.value}
      hint={stat.hint}
      icon={<IconTile tone={stat.tone}>{stat.icon}</IconTile>}
      valueClassName={stat.tone === "muted" ? "text-text" : TONE_TEXT[stat.tone]}
      className={CARD_TONE[stat.tone]}
    />
  );
}

export function TradeLevels({ result }: { result: TradeAnalysisResult }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {primaryLevels(result).map((stat) => (
          <LevelCard key={stat.label} stat={stat} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {secondaryLevels(result).map((stat) => (
          <LevelCard key={stat.label} stat={stat} />
        ))}
      </div>
    </div>
  );
}
