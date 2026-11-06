import { z } from "zod";
import { EXPLANATION_SOURCES } from "@/lib/ai/explanation-schema";
import { MARKETS, SUPPORTED_SYMBOLS, TIMEFRAMES, symbolsFor } from "@/lib/config/market";
import { ERROR_CODES } from "@/lib/errors";
import {
  CONDITION_SIDES,
  MACD_STATES,
  NO_TRADE_CODES,
  RISK_LEVELS,
  SETUP_QUALITIES,
  SIGNAL_STRENGTHS,
  STOP_BASES,
  TARGET_BASES,
  TRENDS,
} from "@/types/signal";

export const analyzeRequestSchema = z
  .strictObject({
    symbol: z.enum(SUPPORTED_SYMBOLS),
    timeframe: z.enum(TIMEFRAMES),
    market: z.enum(MARKETS).default("spot"),
  })
  .refine((value) => symbolsFor(value.market).includes(value.symbol), {
    path: ["symbol"],
    message: "Այս զույգը այս շուկայում չկա։",
  });

const price = z.number().positive();
const nullablePrice = price.nullable();

const baseFields = {
  id: z.string().nullable(),
  symbol: z.enum(SUPPORTED_SYMBOLS),
  timeframe: z.enum(TIMEFRAMES),
  price,
  pricePrecision: z.int().min(0).max(16),
  quantityStep: z.number().positive(),
  minNotional: z.number().nonnegative(),
  confidence: z.int().min(0).max(100),
  signalStrength: z.enum(SIGNAL_STRENGTHS),
  bias: z.enum(TRENDS),
  trend: z.enum(TRENDS),
  higherTimeframe: z.enum(TIMEFRAMES).nullable(),
  higherTrend: z.enum(TRENDS).nullable(),
  setupQuality: z.enum(SETUP_QUALITIES).nullable(),
  indicators: z.object({
    rsi: z.number().min(0).max(100),
    ema20: price,
    ema50: price,
    ema200: nullablePrice,
    macd: z.enum(MACD_STATES),
    macdHistogram: z.number(),
    volumeChange: z.number(),
    atr: z.number().nonnegative(),
  }),
  support: nullablePrice,
  resistance: nullablePrice,
  /** Last closed candles for the mini chart (oldest → newest). */
  recentCandles: z
    .array(
      z.object({
        t: z.number().int().nonnegative(),
        o: price,
        h: price,
        l: price,
        c: price,
      }),
    )
    .min(2)
    .max(60),
  /** Percent change from first → last candle in `recentCandles`. */
  priceChangePct: z.number(),
  conditions: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      side: z.enum(CONDITION_SIDES),
      weight: z.number(),
      met: z.boolean(),
    }),
  ),
  analysis: z.object({
    summary: z.string(),
    reasoning: z.array(z.string()),
    riskWarning: z.string(),
    source: z.enum(EXPLANATION_SOURCES),
    model: z.string().nullable(),
  }),
  engineVersion: z.string(),
  candleTime: z.iso.datetime(),
  createdAt: z.iso.datetime(),
  disclaimer: z.string(),
};

const tradeFields = {
  risk: z.enum(RISK_LEVELS),
  entry: z.object({ min: price, max: price }),
  stopLoss: price,
  takeProfit: price,
  riskReward: z.number().positive(),
  stopBasis: z.enum(STOP_BASES),
  targetBasis: z.enum(TARGET_BASES),
};

export const analysisResultSchema = z
  .discriminatedUnion("direction", [
    z.object({ ...baseFields, ...tradeFields, direction: z.literal("LONG") }),
    z.object({ ...baseFields, ...tradeFields, direction: z.literal("SHORT") }),
    z.object({
      ...baseFields,
      direction: z.literal("NO_TRADE"),
      noTrade: z.object({ code: z.enum(NO_TRADE_CODES), message: z.string() }),
    }),
  ])
  .superRefine((result, ctx) => {
    if (result.direction === "NO_TRADE") return;
    const { entry, stopLoss, takeProfit } = result;
    const ordered =
      result.direction === "LONG"
        ? stopLoss < entry.min && entry.min <= entry.max && entry.max < takeProfit
        : takeProfit < entry.min && entry.min <= entry.max && entry.max < stopLoss;
    if (!ordered) ctx.addIssue({ code: "custom", message: "Inconsistent trade levels" });
  });

export const apiErrorSchema = z.object({
  error: z.object({ code: z.enum(ERROR_CODES), message: z.string() }),
});

export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>;
export type AnalysisResult = z.infer<typeof analysisResultSchema>;
export type TradeAnalysisResult = Extract<AnalysisResult, { direction: "LONG" | "SHORT" }>;
export type ApiError = z.infer<typeof apiErrorSchema>;
