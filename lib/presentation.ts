import type {
  Direction,
  MacdState,
  RiskLevel,
  SetupQuality,
  SignalStrength,
  Trend,
} from "@/types/signal";

export type Tone = "long" | "short" | "caution" | "accent" | "muted";

export const DIRECTION_TONE: Record<Direction, Tone> = {
  LONG: "long",
  SHORT: "short",
  NO_TRADE: "caution",
};

export const DIRECTION_LABEL: Record<Direction, string> = {
  LONG: "ԳՈՐԾԱՐՔ ՎԵՐ ↗",
  SHORT: "ԳՈՐԾԱՐՔ ՆԵՐՔԵՎ ↘",
  NO_TRADE: "ԳՈՐԾԱՐՔ ՉԿԱ",
};

export const DIRECTION_SUBTITLE: Record<Direction, string> = {
  LONG: "Շուկայում կա աճի շարունակման հավանականություն։",
  SHORT: "Շուկայում կա անկման շարունակման հավանականություն։",
  NO_TRADE: "Հստակ ուղղություն չկա․ ավելի լավ է սպասել։",
};

export const STRENGTH_TONE: Record<SignalStrength, Tone> = {
  LOW: "muted",
  MODERATE: "caution",
  STRONG: "accent",
  VERY_STRONG: "long",
};

export const RISK_TONE: Record<RiskLevel, Tone> = {
  LOW: "long",
  MEDIUM: "caution",
  HIGH: "short",
};

export const SETUP_QUALITY_TONE: Record<SetupQuality, Tone> = {
  A: "long",
  B: "accent",
  C: "caution",
};

export const STATUS_DISPLAY: Record<string, { label: string; tone: Tone }> = {
  PENDING: { label: "Ընթացքում", tone: "accent" },
  WIN: { label: "Հաղթ", tone: "long" },
  LOSS: { label: "Պարտ", tone: "short" },
  EXPIRED: { label: "Ժամկետանց", tone: "muted" },
  NOT_APPLICABLE: { label: "—", tone: "muted" },
};

export const TREND_TONE: Record<Trend | MacdState, Tone> = {
  BULLISH: "long",
  BEARISH: "short",
  NEUTRAL: "muted",
};
