import { getServerEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { handleRateLimitedJson, parseJsonBody } from "@/lib/http";
import { createMemoryRateLimiter } from "@/lib/rate-limit";
import { scanRequestSchema } from "@/lib/schemas/scan";
import { marketScanner } from "@/services/scanner";

export const maxDuration = 30;

let rateLimiter: ReturnType<typeof createMemoryRateLimiter> | null = null;

function getRateLimiter() {
  rateLimiter ??= createMemoryRateLimiter({
    limit: getServerEnv().ANALYZE_RATE_LIMIT_PER_MINUTE,
    windowMs: 60_000,
  });
  return rateLimiter;
}

export function POST(request: Request): Promise<Response> {
  return handleRateLimitedJson(request, getRateLimiter, "scan_unhandled_error", async () => {
    const parsed = scanRequestSchema.safeParse(await parseJsonBody(request));
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Չաջակցվող ժամանակաշրջան։");
    return marketScanner.scan(parsed.data);
  });
}
