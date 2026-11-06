import { TIMEFRAME_MS, formatSymbolPair, openForMinutes, tradeDurationText } from "@/lib/config/market";
import type { MarketVenue, Timeframe } from "@/lib/config/market";
import { SIGNAL_EXPIRY_CANDLES } from "@/lib/config/trading";
import { formatPrice } from "@/lib/format";
import type { Tone } from "@/lib/presentation";
import type { AnalysisResult, TradeAnalysisResult } from "@/types/analysis";
import type { NoTradeCode } from "@/types/signal";

export interface ActionGuide {
  tone: Tone;
  title: string;
  summary: string;
  warnings: string[];
  steps: string[];
  /** True when the user can open an UP or DOWN trade now. */
  actionable: boolean;
}

const CAUTION_CONFIDENCE = 65;

const NO_TRADE_REASON: Record<NoTradeCode, string> = {
  WEAK_SIGNAL: "Signal-ը թույլ է. indicator-ները բավարար չափով նույն ուղղությամբ չեն։",
  MIXED_SIGNALS: "Indicator-ները իրար հակասում են։",
  RANGING: "Շուկան կողային է (ADX ցածր). trend-ի signal-ները հաճախ սխալ են լինում։",
  TREND_CONFLICT: "Signal-ը հակառակ է trend-ին։",
  HTF_CONFLICT: "Ավելի բարձր ժամանակաշրջանի trend-ը հակասում է այս signal-ին։",
  OVEREXTENDED: "Գինը արդեն շատ է շարժվել։",
  POOR_RISK_REWARD: "R/R-ը նվազագույնից ցածր է։",
};

export function coinOf(symbol: string): string {
  return symbol.endsWith("USDT") ? symbol.slice(0, -4) : symbol;
}

export function signalLifetimeText(timeframe: Timeframe): string {
  const minutes = (TIMEFRAME_MS[timeframe] * SIGNAL_EXPIRY_CANDLES) / 60_000;
  if (minutes < 60) return `${minutes} րոպե`;
  const hours = minutes / 60;
  return hours < 48 ? `${hours} ժամ` : `${hours / 24} օր`;
}

type TradeSide = "UP" | "DOWN";

function sideLabel(side: TradeSide): string {
  return side === "UP" ? "վերև (UP)" : "ներքև (DOWN)";
}

function priceInEntryZone(result: TradeAnalysisResult): boolean {
  return result.price >= result.entry.min && result.price <= result.entry.max;
}

function tradeWarnings(result: TradeAnalysisResult, side: TradeSide): string[] {
  const warnings: string[] = [];
  if (result.setupQuality === "C") {
    warnings.push("Setup-ի որակը C է— թույլ համաձայնություն կամ թույլ կառուցվածք։");
  }
  if (result.confidence < CAUTION_CONFIDENCE) {
    warnings.push(`Signal-ի ուժը միջին է (${result.confidence}/100)։`);
  }
  if (result.risk === "MEDIUM") warnings.push("Ռիսկը միջին է։");
  if (side === "UP" && result.indicators.rsi >= 70) {
    warnings.push(`RSI ${result.indicators.rsi.toFixed(1)}-ը բարձր է վերևի գործարքի համար։`);
  }
  if (side === "DOWN" && result.indicators.rsi <= 30) {
    warnings.push(`RSI ${result.indicators.rsi.toFixed(1)}-ը ցածր է ներքևի գործարքի համար։`);
  }
  if (!priceInEntryZone(result)) {
    warnings.push(
      side === "UP"
        ? "Գինը Entry zone-ից դուրս է. մի գնիր հիմա Market-ով— սպասիր zone-ին կամ դրիր Limit։"
        : "Գինը Entry zone-ից դուրս է. մի մտիր հիմա Market-ով— սպասիր zone-ին կամ դրիր Limit։",
    );
  }
  return warnings;
}

function tradeSteps(result: TradeAnalysisResult, side: TradeSide): string[] {
  const p = result.pricePrecision;
  const pair = formatSymbolPair(result.symbol);
  const entry = `${formatPrice(result.entry.min, p)} – ${formatPrice(result.entry.max, p)}`;
  const tp = formatPrice(result.takeProfit, p);
  const sl = formatPrice(result.stopLoss, p);
  const inZone = priceInEntryZone(result);

  if (side === "UP") {
    return [
      `Զույգ— ${pair}։ Ուղղություն— վերև (UP)։ Spot-ում սա նշանակում է՝ գնել, հետո վաճառել։`,
      inZone
        ? `Գնել հիմա Entry zone-ում (${entry})։ Ընթացիկ գին— ${formatPrice(result.price, p)}։`
        : `Գնել միայն երբ գինը մտնի Entry zone (${entry})։ Հիմա՝ ${formatPrice(result.price, p)}։`,
      `Երբ վաճառել շահույթով— Take profit ${tp}։ Binance-ում դրիր TP այս գնով։`,
      `Երբ վաճառել կորուստով— Stop loss ${sl}։ Binance-ում դրիր SL այս գնով։`,
      "Ժամանակով մի վաճառիր (օր. 15 րոպե հետո)։ Վաճառիր միայն երբ գինը հասնի TP կամ SL։",
      `Եթե ${signalLifetimeText(result.timeframe)} անցել է ու դեռ չես մտել— այս signal-ով այլևս մի գնիր։`,
      "Մի դիր ավելին, քան պատրաստ ես կորցնել։",
    ];
  }

  return [
    `Զույգ— ${pair}։ Ուղղություն— ներքև (DOWN)։ Սա short է (սկսնակին խորհուրդ չի տրվում Spot-ում)։`,
    inZone
      ? `Մտնել հիմա Entry zone-ում (${entry})։ Ընթացիկ գին— ${formatPrice(result.price, p)}։`
      : `Մտնել միայն երբ գինը մտնի Entry zone (${entry})։ Հիմա՝ ${formatPrice(result.price, p)}։`,
    `Երբ փակել շահույթով— Take profit ${tp}։`,
    `Երբ փակել կորուստով— Stop loss ${sl}։`,
    "Ժամանակով մի փակիր։ Սպասիր TP կամ SL գնին։",
    `Եթե ${signalLifetimeText(result.timeframe)} անցել է ու դեռ չես մտել— այս signal-ով այլևս մի մտիր։`,
    "Մի դիր ավելին, քան պատրաստ ես կորցնել։",
  ];
}

function callSide(side: TradeSide): "UP" | "DOWN" {
  return side === "UP" ? "UP" : "DOWN";
}

function pocketSteps(result: TradeAnalysisResult, side: TradeSide): string[] {
  const duration = tradeDurationText(result.timeframe);
  const call = callSide(side);
  return [
    `Pocket Option · ոչ OTC · ${formatSymbolPair(result.symbol)}։ ${openForMinutes(result.direction, result.timeframe)}։`,
    `Բացիր հիմա։ Գործարքը փակվում է ${duration} հետո, ոչ թե Take profit կամ Stop loss գնով։`,
    "Գինը Binance-ի իրական շուկան է։ Pocket Option-ի OTC գինը այս ռեժիմում չի օգտագործվում։",
    "Դիր միայն այն գումարը, որ պատրաստ ես կորցնել։",
  ];
}

function futuresSteps(result: TradeAnalysisResult, side: TradeSide): string[] {
  const duration = tradeDurationText(result.timeframe);
  const call = callSide(side);
  const p = result.pricePrecision;
  const pair = formatSymbolPair(result.symbol);
  const entry = `${formatPrice(result.entry.min, p)} – ${formatPrice(result.entry.max, p)}`;
  const tp = formatPrice(result.takeProfit, p);
  const sl = formatPrice(result.stopLoss, p);
  const inZone = priceInEntryZone(result);

  return [
    `Futures · ${pair}։ ${openForMinutes(result.direction, result.timeframe)}։`,
    inZone
      ? `Մտիր հիմա Entry zone-ում (${entry})։ Ընթացիկ գին— ${formatPrice(result.price, p)}։`
      : `Մտիր միայն երբ գինը մտնի Entry zone (${entry})։ Հիմա՝ ${formatPrice(result.price, p)}։`,
    `Շահույթի գին— Take profit ${tp}։`,
    `Կորստի գին— Stop loss ${sl}։`,
    `Ժամանակը ${duration} է. դա այս գրաֆիկի մեկ մոմն է։`,
    "Դիր միայն այն գումարը, որ պատրաստ ես կորցնել։",
  ];
}

function directionalGuide(
  result: TradeAnalysisResult,
  side: TradeSide,
  venue: MarketVenue,
): ActionGuide {
  if (result.risk === "HIGH") {
    const duration = tradeDurationText(result.timeframe);
    return {
      tone: "short",
      title: "Չարժե. ռիսկը բարձր է",
      summary:
        venue === "spot"
          ? `Signal-ը ${sideLabel(side)} է, բայց ռիսկը բարձր է։`
          : `Ուղղությունը ${callSide(side)} է, բայց ռիսկը բարձր է։ ${duration}ով մի դիր։`,
      warnings: [],
      steps: ["Ոչինչ մի արա։ Սպասիր ավելի հանգիստ շուկայի։"],
      actionable: false,
    };
  }

  const warnings = tradeWarnings(result, side);
  const p = result.pricePrecision;
  const tp = formatPrice(result.takeProfit, p);
  const sl = formatPrice(result.stopLoss, p);

  if (venue === "pocket") {
    return {
      tone: warnings.length > 0 ? "caution" : side === "UP" ? "long" : "short",
      title:
        warnings.length > 0
          ? `${openForMinutes(result.direction, result.timeframe)}, զգուշությամբ`
          : openForMinutes(result.direction, result.timeframe),
      summary: `Pocket Option · ոչ OTC։ ${openForMinutes(result.direction, result.timeframe)}։ Գործարքը փակվում է ժամանակի վերջում։`,
      warnings,
      steps: pocketSteps(result, side),
      actionable: true,
    };
  }

  if (venue === "futures") {
    return {
      tone: warnings.length > 0 ? "caution" : side === "UP" ? "long" : "short",
      title:
        warnings.length > 0
          ? `${openForMinutes(result.direction, result.timeframe)}, զգուշությամբ`
          : openForMinutes(result.direction, result.timeframe),
      summary: `${openForMinutes(result.direction, result.timeframe)}։ Շահույթ՝ ${tp} (Take profit)։ Կորուստ՝ ${sl} (Stop loss)։`,
      warnings,
      steps: futuresSteps(result, side),
      actionable: true,
    };
  }

  return {
    tone: warnings.length > 0 ? "caution" : side === "UP" ? "long" : "short",
    title:
      warnings.length > 0
        ? `Կարելի է բացել ${sideLabel(side)}, զգուշությամբ`
        : `Բացիր ${sideLabel(side)}`,
    summary:
      side === "UP"
        ? `Գնիր Entry zone-ում։ Վաճառիր շահույթով՝ ${tp} (Take profit)։ Վաճառիր կորուստով՝ ${sl} (Stop loss)։`
        : `Մտիր Entry zone-ում։ Փակիր շահույթով՝ ${tp} (Take profit)։ Փակիր կորուստով՝ ${sl} (Stop loss)։`,
    warnings,
    steps: tradeSteps(result, side),
    actionable: true,
  };
}

export function buildActionGuide(result: AnalysisResult, venue: MarketVenue = "spot"): ActionGuide {
  if (result.direction === "LONG") return directionalGuide(result, "UP", venue);
  if (result.direction === "SHORT") return directionalGuide(result, "DOWN", venue);
  return {
    tone: "caution",
    title: "Հիմա չարժե գործարք բացել",
    summary: NO_TRADE_REASON[result.noTrade.code],
    warnings: [],
    steps:
      venue === "spot"
        ? [
            "Ոչինչ մի արա։ Չմտնելը նույնպես ճիշտ որոշում է։",
            `Կրկին ստուգիր հաջորդ ${result.timeframe} candle-ից հետո կամ օգտագործիր «Որին դնեմ»։`,
          ]
        : [
            venue === "pocket"
              ? "Ոչինչ մի արա։ Pocket Option-ում այս րոպեով մի դիր։"
              : "Ոչինչ մի արա։ Այս գրաֆիկով հիմա րոպե մի դիր։",
            "Կրկին ստուգիր հաջորդ մոմից հետո կամ օգտագործիր «Որին դնեմ»։",
          ],
    actionable: false,
  };
}
