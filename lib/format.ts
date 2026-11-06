export function formatPrice(value: number | null, precision: number): string {
  if (value === null) return "—";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  });
}

export function formatSignedPercent(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

export function formatRatio(value: number | null): string {
  return value === null ? "—" : `1 : ${value.toFixed(2)}`;
}

export function formatDateTime(value: Date | string): string {
  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
}

const HUMANIZE_HY: Record<string, string> = {
  BULLISH: "Աճային",
  BEARISH: "Անկումային",
  NEUTRAL: "Չեզոք",
  LOW: "Թույլ",
  MODERATE: "Միջին",
  STRONG: "Ուժեղ",
  VERY_STRONG: "Շատ ուժեղ",
  MEDIUM: "Միջին",
  HIGH: "Բարձր",
  WEAK_SIGNAL: "Թույլ signal",
  MIXED_SIGNALS: "Խառը signal-ներ",
  RANGING: "Կողային շուկա",
  TREND_CONFLICT: "Trend-ի հակասություն",
  OVEREXTENDED: "Գերերկարացված",
  POOR_RISK_REWARD: "Վատ R/R",
};

export function humanize(value: string): string {
  if (HUMANIZE_HY[value]) return HUMANIZE_HY[value];
  const lower = value.replaceAll("_", " ").toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}
