import type { ReactNode } from "react";
import type { Tone } from "@/lib/presentation";

const TILE_TONE: Record<Tone, string> = {
  long: "border-long/40 bg-long/10 text-long shadow-[0_0_18px_rgb(34_227_138_/_0.18)]",
  short: "border-short/40 bg-short/10 text-short shadow-[0_0_18px_rgb(242_85_106_/_0.18)]",
  caution: "border-caution/40 bg-caution/10 text-caution shadow-[0_0_18px_rgb(245_185_66_/_0.16)]",
  accent: "border-accent/40 bg-accent/10 text-accent-glow shadow-[0_0_18px_rgb(34_211_238_/_0.18)]",
  muted: "border-border-strong bg-surface-raised/80 text-muted",
};

const TILE_SIZE = {
  sm: "size-8 rounded-lg",
  md: "size-10 rounded-xl",
  lg: "size-14 rounded-2xl [&_svg]:size-7",
} as const;

interface IconTileProps {
  tone: Tone;
  size?: keyof typeof TILE_SIZE;
  children: ReactNode;
}

export function IconTile({ tone, size = "md", children }: IconTileProps) {
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center border ${TILE_SIZE[size]} ${TILE_TONE[tone]}`}
    >
      {children}
    </span>
  );
}
