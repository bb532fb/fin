import { TONE_TEXT } from "@/components/ui/badge";
import { CONFIDENCE_DISCLAIMER, STRENGTH_BANDS } from "@/lib/config/trading";
import { humanize } from "@/lib/format";
import { STRENGTH_TONE } from "@/lib/presentation";
import type { SignalStrength } from "@/types/signal";

interface ConfidenceMeterProps {
  confidence: number;
  strength: SignalStrength;
}

const MARKERS = [STRENGTH_BANDS.moderate, STRENGTH_BANDS.strong, STRENGTH_BANDS.veryStrong];

export function ConfidenceMeter({ confidence, strength }: ConfidenceMeterProps) {
  const tone = STRENGTH_TONE[strength];
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-surface-raised/40 p-4">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-sm text-muted">Signal-ի ուժ</span>
        <span className="font-mono text-sm tabular-nums">
          <span className={`text-2xl font-bold ${TONE_TEXT[tone]}`}>{confidence}</span>
          <span className="text-muted"> / 100 բալ</span>
          <span className={`ml-2 font-sans text-xs font-semibold ${TONE_TEXT[tone]}`}>
            {humanize(strength)}
          </span>
        </span>
      </div>
      <div
        role="meter"
        aria-label="Signal-ի ուժ"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={confidence}
        className="relative h-3 overflow-hidden rounded-full bg-bg/80"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-accent-glow to-accent shadow-[0_0_16px_rgb(34_211_238_/_0.45)] transition-[width] duration-700"
          style={{ width: `${confidence}%` }}
        />
        {MARKERS.map((marker) => (
          <span
            key={marker}
            aria-hidden
            className="absolute top-0 h-full w-px bg-bg/80"
            style={{ left: `${marker}%` }}
          />
        ))}
      </div>
      <div className="flex justify-between text-[10px] uppercase tracking-wider text-subtle">
        <span>Թույլ</span>
        <span>Միջին</span>
        <span>Ուժեղ</span>
        <span>Շատ ուժեղ</span>
      </div>
      <p className="text-xs leading-relaxed text-subtle">{CONFIDENCE_DISCLAIMER}</p>
    </div>
  );
}
