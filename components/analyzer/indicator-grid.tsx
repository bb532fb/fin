import type { ReactNode } from "react";
import { Badge, TONE_TEXT } from "@/components/ui/badge";
import { BarsIcon, PulseIcon, TrendDownIcon, TrendUpIcon } from "@/components/ui/icons";
import { formatPrice, formatSignedPercent, humanize } from "@/lib/format";
import { TREND_TONE } from "@/lib/presentation";
import type { Tone } from "@/lib/presentation";
import type { AnalysisResult } from "@/types/analysis";

interface IndicatorTileProps {
  label: string;
  value: string;
  status: string;
  tone: Tone;
  icon?: ReactNode;
  title?: string;
}

function IndicatorTile({ label, value, status, tone, icon, title }: IndicatorTileProps) {
  return (
    <div
      title={title}
      className="flex flex-col gap-2 rounded-xl border border-border/80 bg-surface-raised/50 p-4 transition hover:border-border-strong"
    >
      <span className="text-xs font-medium uppercase tracking-wider text-muted">{label}</span>
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-lg font-bold tabular-nums text-text">{value}</span>
        <span className={TONE_TEXT[tone]}>
          {icon ?? (tone === "short" ? <TrendDownIcon /> : <TrendUpIcon />)}
        </span>
      </div>
      <span>
        <Badge tone={tone}>{status}</Badge>
      </span>
    </div>
  );
}

function rsiStatus(rsi: number): { status: string; tone: Tone } {
  if (rsi >= 70) return { status: "Գերգնված", tone: "caution" };
  if (rsi <= 30) return { status: "Գերվաճառված", tone: "caution" };
  return rsi >= 50 ? { status: "Աճային կողմ", tone: "long" } : { status: "Անկումային կողմ", tone: "short" };
}

function emaStatus(price: number, ema: number | null): { status: string; tone: Tone } {
  if (ema == null) return { status: "Տվյալ չկա", tone: "muted" };
  return price >= ema ? { status: "Աջակցություն", tone: "long" } : { status: "Դիմադրություն", tone: "short" };
}

export function IndicatorGrid({ result }: { result: AnalysisResult }) {
  const { indicators: ind, pricePrecision: p, price } = result;
  const volumeUp = ind.volumeChange >= 0;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <IndicatorTile label="RSI (14)" value={ind.rsi.toFixed(1)} icon={<PulseIcon />} {...rsiStatus(ind.rsi)} />
      <IndicatorTile
        label="MACD"
        value={humanize(ind.macd)}
        status={`Hist ${ind.macdHistogram >= 0 ? "+" : ""}${ind.macdHistogram.toFixed(2)}`}
        tone={TREND_TONE[ind.macd]}
        icon={<BarsIcon />}
      />
      <IndicatorTile label="EMA 20" value={formatPrice(ind.ema20, p)} {...emaStatus(price, ind.ema20)} />
      <IndicatorTile label="EMA 50" value={formatPrice(ind.ema50, p)} {...emaStatus(price, ind.ema50)} />
      <IndicatorTile label="EMA 200" value={formatPrice(ind.ema200, p)} {...emaStatus(price, ind.ema200)} />
      <IndicatorTile
        label="Volume"
        value={formatSignedPercent(ind.volumeChange)}
        status={volumeUp ? "Աճ" : "Անկում"}
        tone={volumeUp ? "long" : "short"}
        icon={<BarsIcon />}
        title="Վերջին 5-ը նախորդ 20-ի նկատմամբ"
      />
    </div>
  );
}
