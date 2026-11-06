-- Persist alert dedupe state and tick lock across serverless instances.
ALTER TABLE "AlertWatch" ADD COLUMN "signalState" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "AlertWatch" ADD COLUMN "lastTickAt" TIMESTAMP(3);
