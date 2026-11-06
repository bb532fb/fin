import {
  INDICATOR_PERIODS,
  RSI_ZONES,
  RISK_RULES,
  SIGNAL_THRESHOLDS,
  STRENGTH_BANDS,
} from "@/lib/config/trading";
import type { AiExplanation } from "@/lib/ai/explanation-schema";
import type { AnalysisFacts } from "@/lib/ai/facts";

/** Phrases that imply certainty or promised returns. Any match rejects the AI output. */
const FORBIDDEN_PATTERNS: readonly RegExp[] = [
  /\bguaranteed?\s+(profit|profits|win|wins|return|returns|gain|gains|results?)\b/i,
  /\b100\s?%/i,
  /\brisk[-\s]?free\b/i,
  /\b(sure|certain)\s+(thing|bet|profit|win|gain)\b/i,
  /\byou\s+will\s+(make|earn|profit|win)\b/i,
  /\b(can(?:'|no)?t|cannot)\s+lose\b/i,
  /\bwill\s+(definitely|certainly|surely)\b/i,
  /\bno\s+risk\b/i,
];

const KNOWN_CONSTANTS: readonly number[] = [
  ...Object.values(INDICATOR_PERIODS),
  ...Object.values(RSI_ZONES),
  ...Object.values(STRENGTH_BANDS),
  ...Object.values(SIGNAL_THRESHOLDS),
  RISK_RULES.minRiskReward,
  RISK_RULES.projectedTargetR,
  100,
];

function extractNumbers(text: string): number[] {
  const matches = text.match(/-?\d[\d,]*(?:\.\d+)?/g) ?? [];
  return matches.map((m) => Number(m.replace(/,/g, ""))).filter(Number.isFinite);
}

/** Numbers from numeric fields and from strings (e.g. "15m", condition labels). */
function collectNumbers(value: unknown, into: number[]): number[] {
  if (typeof value === "number" && Number.isFinite(value)) into.push(value);
  else if (typeof value === "string") into.push(...extractNumbers(value));
  else if (Array.isArray(value)) value.forEach((item) => collectNumbers(item, into));
  else if (value && typeof value === "object") {
    Object.values(value).forEach((item) => collectNumbers(item, into));
  }
  return into;
}

function isKnownNumber(candidate: number, allowed: readonly number[]): boolean {
  const abs = Math.abs(candidate);
  if (Number.isInteger(candidate) && abs < 10) return true;
  return allowed.some((known) => {
    const tolerance = Math.max(Math.abs(known) * 0.01, 0.06);
    return Math.abs(Math.abs(known) - abs) <= tolerance;
  });
}

export type GuardrailResult = { ok: true } | { ok: false; reason: string };

/** Rejects explanations that promise results or mention numbers not present in the facts. */
export function checkExplanation(explanation: AiExplanation, facts: AnalysisFacts): GuardrailResult {
  const texts = [explanation.summary, ...explanation.reasoning, explanation.riskWarning];
  const allowed = [...collectNumbers(facts, []), ...KNOWN_CONSTANTS];

  for (const text of texts) {
    const forbidden = FORBIDDEN_PATTERNS.find((pattern) => pattern.test(text));
    if (forbidden) return { ok: false, reason: `forbidden_phrase:${forbidden.source}` };

    const unknown = extractNumbers(text).find((n) => !isKnownNumber(n, allowed));
    if (unknown !== undefined) return { ok: false, reason: `unknown_number:${unknown}` };
  }
  return { ok: true };
}
