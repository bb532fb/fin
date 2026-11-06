import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { getServerEnv } from "@/lib/env";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/** Single PrismaClient per process (survives dev hot reloads). Throws if DATABASE_URL is missing. */
export function getDb(): PrismaClient {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;
  const { DATABASE_URL } = getServerEnv();
  if (!DATABASE_URL) throw new Error("DATABASE_URL is not configured");

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: DATABASE_URL }) });
  globalForPrisma.prisma = prisma;
  return prisma;
}
