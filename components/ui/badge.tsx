import type { ReactNode } from "react";
import type { Tone } from "@/lib/presentation";

const TONE_CLASSES: Record<Tone, string> = {
  long: "border-long/35 bg-long/10 text-long shadow-[0_0_12px_rgb(34_227_138_/_0.12)]",
  short: "border-short/35 bg-short/10 text-short shadow-[0_0_12px_rgb(242_85_106_/_0.12)]",
  caution: "border-caution/35 bg-caution/10 text-caution",
  accent: "border-accent/35 bg-accent/10 text-accent-glow shadow-[0_0_12px_rgb(34_211_238_/_0.12)]",
  muted: "border-border-strong bg-surface-raised/80 text-muted",
};

export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}

export const TONE_TEXT: Record<Tone, string> = {
  long: "text-long",
  short: "text-short",
  caution: "text-caution",
  accent: "text-accent-glow",
  muted: "text-muted",
};

export const TONE_BG: Record<Tone, string> = {
  long: "bg-long",
  short: "bg-short",
  caution: "bg-caution",
  accent: "bg-accent-glow",
  muted: "bg-subtle",
};
