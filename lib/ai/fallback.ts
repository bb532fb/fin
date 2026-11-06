import { formatSymbolPair } from "@/lib/config/market";
import { NO_TRADE_MESSAGE, RSI_ZONES, SIGNAL_THRESHOLDS } from "@/lib/config/trading";
import type { Explanation } from "@/lib/ai/explanation-schema";
import type { AnalysisFacts } from "@/lib/ai/facts";

const MAX_REASONS = 5;

function trendLabel(trend: AnalysisFacts["trend"]): string {
  if (trend === "BULLISH") return "աճող";
  if (trend === "BEARISH") return "անկումային";
  return "կողային";
}

function macdLabel(macd: string): string {
  if (macd === "BULLISH") return "աճային";
  if (macd === "BEARISH") return "անկումային";
  return macd.toLowerCase();
}

function strengthLabel(strength: string): string {
  const map: Record<string, string> = {
    LOW: "թույլ",
    MODERATE: "միջին",
    STRONG: "ուժեղ",
    VERY_STRONG: "շատ ուժեղ",
  };
  return map[strength] ?? strength.toLowerCase();
}

function buildSummary(facts: AnalysisFacts): string {
  const pair = formatSymbolPair(facts.symbol);
  if (facts.direction === "NO_TRADE") {
    return (
      `Ընթացիկ վերլուծությունը խորհուրդ չի տալիս գործարք բացել ${pair}-ում ` +
      `${facts.timeframe} ժամանակաշրջանում— signal-ի ցածր ուժի պատճառով ` +
      `(${facts.confidence}/100)։ ${facts.noTradeReason ?? NO_TRADE_MESSAGE}`
    ).trim();
  }
  const sideLabel = facts.direction === "LONG" ? "աճային (LONG)" : "անկումային (SHORT)";
  return (
    `${pair} ${facts.timeframe}-ում գերակշռում են ${sideLabel} պայմանները— signal confidence ` +
    `${facts.confidence}/100 (${strengthLabel(facts.signalStrength)})։ ` +
    `Վաճառիր/փակիր շահույթով՝ Take Profit ${facts.takeProfit}։ ` +
    `Վաճառիր/փակիր կորուստով՝ Stop Loss ${facts.stopLoss}։ R/R ≈ ${facts.riskReward}։ ` +
    `Ժամանակով մի վաճառիր— սպասիր այդ գներին։`
  );
}

function buildReasons(facts: AnalysisFacts): string[] {
  const reasons: string[] = [];

  if (facts.direction === "NO_TRADE") {
    reasons.push(
      `Ուղղություն և վստահություն. NO_TRADE, որովհետև signal confidence-ը ${facts.confidence}/100 է ` +
        `(պահանջվում է առնվազն ${SIGNAL_THRESHOLDS.minConfidence}/100)։`,
    );
  } else {
    reasons.push(
      `Ուղղություն և վստահություն. ${facts.direction}, signal confidence ${facts.confidence}/100։ ` +
        `Վաճառքի գներ— TP ${facts.takeProfit}, SL ${facts.stopLoss}։`,
    );
  }

  const ema200Part =
    facts.indicators.ema200 === null
      ? ""
      : `, EMA50 ${facts.indicators.ema50} և EMA200 ${facts.indicators.ema200}`;
  reasons.push(
    `Trend (EMA). Շուկան ${trendLabel(facts.trend)} է. EMA20— ${facts.indicators.ema20}, ` +
      `EMA50— ${facts.indicators.ema50}${ema200Part}։`,
  );

  const rsiZone =
    facts.indicators.rsi >= RSI_ZONES.bullMin && facts.indicators.rsi <= RSI_ZONES.bullMax
      ? `աճային գոտի (${RSI_ZONES.bullMin}-${RSI_ZONES.bullMax})`
      : facts.indicators.rsi >= RSI_ZONES.bearMin && facts.indicators.rsi < RSI_ZONES.bearMax
        ? `անկումային գոտի (${RSI_ZONES.bearMin}-${RSI_ZONES.bearMax})`
        : "չեզոք գոտի";
  reasons.push(
    `Oscillators. RSI— ${facts.indicators.rsi} (${rsiZone})։ MACD— ${macdLabel(facts.indicators.macd)} ` +
      `(histogram ${facts.indicators.macdHistogram})։`,
  );

  const vol = facts.indicators.volumeChangePct;
  reasons.push(
    `Volume. Ծավալը փոխվել է ${vol}%-ով` +
      (vol < 0 ? ", ինչը նվազեցնում է գործարքի վստահությունը։" : "։"),
  );

  if (facts.support !== null || facts.resistance !== null) {
    reasons.push(
      `Support և Resistance. Support— ${facts.support ?? "n/a"}, Resistance— ${facts.resistance ?? "n/a"}։`,
    );
  }

  return reasons.slice(0, MAX_REASONS);
}

/** Deterministic explanation used when the AI is unavailable or its output fails guardrails. */
export function buildRuleBasedExplanation(facts: AnalysisFacts): Explanation {
  return {
    summary: buildSummary(facts),
    reasoning: buildReasons(facts),
    riskWarning:
      "Շուկայական պայմանները կարող են արագ փոխվել, և տեխնիկական setup-ները հաճախ ձախողվում են։ " +
      "Առևտուրը ռիսկ է պարունակում. դիրքի չափը ընտրիր այնպես, որ Stop Loss-ի հարվածը լինի կրելի։",
    source: "RULES",
    model: null,
  };
}
