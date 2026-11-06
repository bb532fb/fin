import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { TIMEFRAME_MS } from "@/lib/config/market";
import type { MarketVenue } from "@/lib/config/market";
import { SIGNAL_EXPIRY_CANDLES } from "@/lib/config/trading";
import { getDb } from "@/lib/db";
import type { AnalysisResult } from "@/types/analysis";

export interface AnalysisRepository {
  save(result: AnalysisResult, market?: MarketVenue): Promise<string>;
}

export interface AnalysisHistoryItem {
  id: string;
  createdAt: Date;
  symbol: string;
  timeframe: string;
  market: string;
  price: number;
  pricePrecision: number;
  direction: AnalysisResult["direction"];
  confidence: number;
  signalStrength: string;
  risk: string | null;
  entryMin: number | null;
  entryMax: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  riskReward: number | null;
  status: string;
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

/** Decimal columns receive exact strings; passing JS numbers stores float noise (e.g. 83591.1499999). */
function toDecimal(value: number | null | undefined, decimals: number): string | null {
  return value === null || value === undefined ? null : value.toFixed(decimals);
}

function expiresAtFor(result: AnalysisResult, market: MarketVenue, createdAt: Date): Date | null {
  if (result.direction === "NO_TRADE") return null;
  const candles = market === "pocket" ? 1 : SIGNAL_EXPIRY_CANDLES;
  return new Date(createdAt.getTime() + TIMEFRAME_MS[result.timeframe] * candles);
}

function toCreateInput(result: AnalysisResult, market: MarketVenue): Prisma.AnalysisCreateInput {
  const createdAt = new Date(result.createdAt);
  const trade = result.direction === "NO_TRADE" ? null : result;
  const p = result.pricePrecision;
  return {
    createdAt,
    symbol: result.symbol,
    timeframe: result.timeframe,
    market,
    price: result.price.toFixed(p),
    pricePrecision: p,
    candleOpenTime: new Date(result.candleTime),
    direction: result.direction,
    confidence: result.confidence,
    signalStrength: result.signalStrength,
    trend: result.trend,
    risk: trade?.risk ?? null,
    entryMin: toDecimal(trade?.entry.min, p),
    entryMax: toDecimal(trade?.entry.max, p),
    stopLoss: toDecimal(trade?.stopLoss, p),
    takeProfit: toDecimal(trade?.takeProfit, p),
    riskReward: toDecimal(trade?.riskReward, 2),
    support: toDecimal(result.support, p),
    resistance: toDecimal(result.resistance, p),
    indicators: toJson(result.indicators),
    conditions: toJson(result.conditions),
    noTradeCode: result.direction === "NO_TRADE" ? result.noTrade.code : null,
    explanation: toJson(result.analysis),
    explanationSource: result.analysis.source,
    aiModel: result.analysis.model,
    engineVersion: result.engineVersion,
    status: trade ? "PENDING" : "NOT_APPLICABLE",
    expiresAt: expiresAtFor(result, market, createdAt),
  };
}

async function save(result: AnalysisResult, market: MarketVenue = "spot"): Promise<string> {
  const record = await getDb().analysis.create({
    data: toCreateInput(result, market),
    select: { id: true },
  });
  return record.id;
}

const toNumber = (value: Prisma.Decimal | null) => (value === null ? null : Number(value));

export interface HistoryListFilter {
  status?: "WIN" | "LOSS" | "PENDING" | "EXPIRED" | "TRADES";
  direction?: "LONG" | "SHORT";
  minConfidence?: number;
  market?: MarketVenue;
}

function listWhere(filter: HistoryListFilter): Prisma.AnalysisWhereInput {
  const where: Prisma.AnalysisWhereInput = {};
  if (filter.status === "TRADES") {
    where.direction = { in: ["LONG", "SHORT"] };
  } else if (filter.status) {
    where.status = filter.status;
    where.direction = { in: ["LONG", "SHORT"] };
  }
  if (filter.direction) where.direction = filter.direction;
  if (filter.minConfidence !== undefined) where.confidence = { gte: filter.minConfidence };
  if (filter.market) where.market = filter.market;
  return where;
}

export async function listAnalyses(page: number, pageSize: number, filter: HistoryListFilter = {}) {
  const db = getDb();
  const where = listWhere(filter);
  const [rows, total] = await Promise.all([
    db.analysis.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.analysis.count({ where }),
  ]);

  const items: AnalysisHistoryItem[] = rows.map((row) => ({
    id: row.id,
    createdAt: row.createdAt,
    symbol: row.symbol,
    timeframe: row.timeframe,
    market: row.market,
    price: Number(row.price),
    pricePrecision: row.pricePrecision,
    direction: row.direction,
    confidence: row.confidence,
    signalStrength: row.signalStrength,
    risk: row.risk,
    entryMin: toNumber(row.entryMin),
    entryMax: toNumber(row.entryMax),
    stopLoss: toNumber(row.stopLoss),
    takeProfit: toNumber(row.takeProfit),
    riskReward: toNumber(row.riskReward),
    status: row.status,
  }));
  return { items, total };
}

export interface BreakdownRow {
  key: string;
  label: string;
  wins: number;
  losses: number;
  winRate: number | null;
}

export interface OutcomeBreakdown {
  byDirection: BreakdownRow[];
  byTimeframe: BreakdownRow[];
  byConfidence: BreakdownRow[];
}

function confidenceBand(confidence: number): string {
  if (confidence >= 75) return "75+";
  if (confidence >= 65) return "65–74";
  return "55–64";
}

function toBreakdownRows(
  groups: Map<string, { wins: number; losses: number }>,
  labelOf: (key: string) => string,
): BreakdownRow[] {
  return [...groups.entries()]
    .map(([key, { wins, losses }]) => {
      const closed = wins + losses;
      return {
        key,
        label: labelOf(key),
        wins,
        losses,
        winRate: closed === 0 ? null : wins / closed,
      };
    })
    .sort((a, b) => b.wins + b.losses - (a.wins + a.losses));
}

/** Closed WIN/LOSS trades only — used to see which setups win more often. */
export async function getOutcomeBreakdown(
  engineVersion: string,
  market: MarketVenue = "spot",
): Promise<OutcomeBreakdown> {
  const rows = await getDb().analysis.findMany({
    where: {
      engineVersion,
      market,
      direction: { in: ["LONG", "SHORT"] },
      status: { in: ["WIN", "LOSS"] },
    },
    select: { direction: true, timeframe: true, confidence: true, status: true },
  });

  const byDirection = new Map<string, { wins: number; losses: number }>();
  const byTimeframe = new Map<string, { wins: number; losses: number }>();
  const byConfidence = new Map<string, { wins: number; losses: number }>();

  const bump = (map: Map<string, { wins: number; losses: number }>, key: string, win: boolean) => {
    const current = map.get(key) ?? { wins: 0, losses: 0 };
    if (win) current.wins += 1;
    else current.losses += 1;
    map.set(key, current);
  };

  for (const row of rows) {
    const win = row.status === "WIN";
    bump(byDirection, row.direction, win);
    bump(byTimeframe, row.timeframe, win);
    bump(byConfidence, confidenceBand(row.confidence), win);
  }

  return {
    byDirection: toBreakdownRows(byDirection, (key) =>
      key === "LONG" ? "Վերև (UP)" : "Ներքև (DOWN)",
    ),
    byTimeframe: toBreakdownRows(byTimeframe, (key) => key),
    byConfidence: toBreakdownRows(byConfidence, (key) => `Ուժ ${key}`),
  };
}

export interface PerformanceStats {
  engineVersion: string;
  wins: number;
  losses: number;
  /** Entered but neither stop nor target reached before expiry. */
  expiredOpen: number;
  /** Limit entry never filled before expiry. */
  expiredUnfilled: number;
  pending: number;
  /** WIN/(WIN+LOSS), null until something closed. */
  winRate: number | null;
  /** Average result per closed trade in R (risk units), before fees; null until something closed. */
  expectancyR: number | null;
}

export async function getPerformanceStats(
  engineVersion: string,
  market: MarketVenue = "spot",
): Promise<PerformanceStats> {
  const db = getDb();
  const where = { engineVersion, market, direction: { in: ["LONG" as const, "SHORT" as const] } };
  const [groups, winR, expiredOpen] = await Promise.all([
    db.analysis.groupBy({ by: ["status"], where, _count: { _all: true } }),
    db.analysis.aggregate({ where: { ...where, status: "WIN" }, _sum: { riskReward: true } }),
    db.analysis.count({ where: { ...where, status: "EXPIRED", entryTriggeredAt: { not: null } } }),
  ]);
  const count = (status: string) => groups.find((g) => g.status === status)?._count._all ?? 0;
  const wins = count("WIN");
  const losses = count("LOSS");
  const closed = wins + losses;
  const totalR = Number(winR._sum.riskReward ?? 0) - losses;
  return {
    engineVersion,
    wins,
    losses,
    expiredOpen,
    expiredUnfilled: count("EXPIRED") - expiredOpen,
    pending: count("PENDING"),
    winRate: closed === 0 ? null : wins / closed,
    expectancyR: closed === 0 ? null : totalR / closed,
  };
}

export const prismaAnalysisRepository: AnalysisRepository = { save };
