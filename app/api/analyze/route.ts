import { getServerEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { handleRateLimitedJson, parseJsonBody } from "@/lib/http";
import { createMemoryRateLimiter } from "@/lib/rate-limit";
import { analyzeRequestSchema } from "@/lib/schemas/analysis";
import { analysisService } from "@/services/analysis";

export const maxDuration = 60;

let rateLimiter: ReturnType<typeof createMemoryRateLimiter> | null = null;

function getRateLimiter() {
  rateLimiter ??= createMemoryRateLimiter({
    limit: getServerEnv().ANALYZE_RATE_LIMIT_PER_MINUTE,
    windowMs: 60_000,
  });
  return rateLimiter;
}

export function POST(request: Request): Promise<Response> {
  return handleRateLimitedJson(request, getRateLimiter, "analyze_unhandled_error", async () => {
    const parsed = analyzeRequestSchema.safeParse(await parseJsonBody(request));
    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR", "Չաջակցվող զույգ կամ ժամանակաշրջան։");
    }
    return analysisService.analyze(parsed.data);
  });
}
