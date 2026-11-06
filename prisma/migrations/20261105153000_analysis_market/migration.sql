-- Futures and Pocket Option analyses are stored beside spot, with their own outcome rules.
ALTER TABLE "Analysis" ADD COLUMN "market" TEXT NOT NULL DEFAULT 'spot';

CREATE INDEX "Analysis_market_createdAt_idx" ON "Analysis"("market", "createdAt" DESC);
