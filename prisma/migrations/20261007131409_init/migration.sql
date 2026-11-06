-- CreateEnum
CREATE TYPE "Direction" AS ENUM ('LONG', 'SHORT', 'NO_TRADE');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "AnalysisStatus" AS ENUM ('PENDING', 'WIN', 'LOSS', 'EXPIRED', 'NOT_APPLICABLE');

-- CreateTable
CREATE TABLE "Analysis" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "symbol" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL,
    "price" DECIMAL(30,12) NOT NULL,
    "pricePrecision" INTEGER NOT NULL,
    "candleOpenTime" TIMESTAMP(3) NOT NULL,
    "direction" "Direction" NOT NULL,
    "confidence" INTEGER NOT NULL,
    "signalStrength" TEXT NOT NULL,
    "trend" TEXT NOT NULL,
    "risk" "RiskLevel",
    "entryMin" DECIMAL(30,12),
    "entryMax" DECIMAL(30,12),
    "stopLoss" DECIMAL(30,12),
    "takeProfit" DECIMAL(30,12),
    "riskReward" DECIMAL(10,2),
    "support" DECIMAL(30,12),
    "resistance" DECIMAL(30,12),
    "indicators" JSONB NOT NULL,
    "conditions" JSONB NOT NULL,
    "noTradeCode" TEXT,
    "explanation" JSONB NOT NULL,
    "explanationSource" TEXT NOT NULL,
    "aiModel" TEXT,
    "engineVersion" TEXT NOT NULL,
    "status" "AnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3),
    "entryTriggeredAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "priceAtResolution" DECIMAL(30,12),

    CONSTRAINT "Analysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Analysis_createdAt_idx" ON "Analysis"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "Analysis_symbol_timeframe_createdAt_idx" ON "Analysis"("symbol", "timeframe", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Analysis_status_expiresAt_idx" ON "Analysis"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "Analysis_userId_createdAt_idx" ON "Analysis"("userId", "createdAt" DESC);
