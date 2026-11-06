import "server-only";
import { AppError, describeError, isAppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { getClientIdentifier } from "@/lib/rate-limit";
import type { createMemoryRateLimiter, RateLimitResult } from "@/lib/rate-limit";
import type { ApiError } from "@/types/analysis";

const MAX_BODY_BYTES = 1_024;

type RateLimiter = ReturnType<typeof createMemoryRateLimiter>;

function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "RateLimit-Limit": String(result.limit),
    "RateLimit-Remaining": String(result.remaining),
    "RateLimit-Reset": String(Math.max(0, Math.ceil((result.resetAt - Date.now()) / 1000))),
  };
}

function errorResponse(error: AppError, headers: Record<string, string> = {}): Response {
  const body: ApiError = { error: { code: error.code, message: error.message } };
  const allHeaders: Record<string, string> = { "Cache-Control": "no-store", ...headers };
  if (error.retryAfterSeconds) allHeaders["Retry-After"] = String(error.retryAfterSeconds);
  return Response.json(body, { status: error.status, headers: allHeaders });
}

export async function parseJsonBody(request: Request): Promise<unknown> {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    throw new AppError("PAYLOAD_TOO_LARGE", "Հարցման մարմինը չափազանց մեծ է։");
  }
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) {
    throw new AppError("PAYLOAD_TOO_LARGE", "Հարցման մարմինը չափազանց մեծ է։");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new AppError("VALIDATION_ERROR", "Հարցման մարմինը պետք է լինի վավեր JSON։");
  }
}

/**
 * JSON handler with the same error shape as the rate-limited routes.
 * Only AppError messages reach clients; anything else is logged and masked.
 */
export async function handleJson(event: string, handler: () => Promise<unknown>): Promise<Response> {
  try {
    const body = await handler();
    return Response.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (isAppError(error)) return errorResponse(error);
    logger.error(event, { error: describeError(error) });
    return errorResponse(new AppError("INTERNAL_ERROR", "Ինչ-որ սխալ տեղի ունեցավ։ Փորձիր նորից։"));
  }
}

/**
 * Runs a JSON POST handler behind a rate limit with uniform error responses.
 * Only AppError messages reach clients; anything else is logged and masked.
 */
export async function handleRateLimitedJson(
  request: Request,
  getLimiter: () => RateLimiter,
  event: string,
  handler: () => Promise<unknown>,
): Promise<Response> {
  let limitHeaders: Record<string, string> = {};
  try {
    const limit = await getLimiter().consume(getClientIdentifier(request.headers));
    limitHeaders = rateLimitHeaders(limit);
    if (!limit.allowed) {
      const retryAfterSeconds = Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000));
      throw new AppError("RATE_LIMITED", "Չափից շատ հարցում։ Սպասիր մի պահ։", {
        retryAfterSeconds,
      });
    }
    const body = await handler();
    return Response.json(body, { headers: { "Cache-Control": "no-store", ...limitHeaders } });
  } catch (error) {
    if (isAppError(error)) return errorResponse(error, limitHeaders);
    logger.error(event, { error: describeError(error) });
    return errorResponse(
      new AppError("INTERNAL_ERROR", "Ինչ-որ սխալ տեղի ունեցավ։ Փորձիր նորից։"),
      limitHeaders,
    );
  }
}
