-- Persist alert watch switches across serverless instances (Vercel has no writable local disk).
CREATE TABLE "AlertWatch" (
    "id" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "venues" JSONB NOT NULL,
    "muted" JSONB NOT NULL,

    CONSTRAINT "AlertWatch_pkey" PRIMARY KEY ("id")
);
