import { z } from "zod";
import { MARKETS, SUPPORTED_SYMBOLS, TIMEFRAMES } from "@/lib/config/market";
import { DIRECTIONS, NO_TRADE_CODES, RISK_LEVELS, SETUP_QUALITIES, TRENDS } from "@/types/signal";

export const scanRequestSchema = z.strictObject({
  timeframe: z.enum(TIMEFRAMES),
  market: z.enum(MARKETS).default("spot"),
});

export const scanItemSchema = z.object({
  symbol: z.enum(SUPPORTED_SYMBOLS),
  direction: z.enum(DIRECTIONS),
  /** Side the scores favoured, including when filters still say NO_TRADE. */
  bias: z.enum(TRENDS),
  /** Trend on the next higher chart. Null when that chart does not exist. */
  higherTrend: z.enum(TRENDS).nullable(),
  confidence: z.int().min(0).max(100),
  risk: z.enum(RISK_LEVELS).nullable(),
  riskReward: z.number().positive().nullable(),
  setupQuality: z.enum(SETUP_QUALITIES).nullable(),
  noTradeCode: z.enum(NO_TRADE_CODES).nullable(),
  price: z.number().positive(),
  pricePrecision: z.int().min(0).max(16),
});

export const scanResultSchema = z.object({
  timeframe: z.enum(TIMEFRAMES),
  market: z.enum(MARKETS),
  createdAt: z.iso.datetime(),
  items: z.array(scanItemSchema),
  /** Symbols whose market data could not be fetched in this scan. */
  failed: z.array(z.enum(SUPPORTED_SYMBOLS)),
});

export type ScanRequest = z.infer<typeof scanRequestSchema>;
export type ScanItem = z.infer<typeof scanItemSchema>;
export type ScanResult = z.infer<typeof scanResultSchema>;
