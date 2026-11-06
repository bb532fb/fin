export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

/**
 * Swap the in-memory implementation for a shared store (e.g. Redis/Upstash) before
 * running multiple instances; in-memory limits are per process only.
 * Keys can later be user IDs or plan-specific (free vs pro) without changing callers.
 */
export interface RateLimiter {
  consume(key: string): Promise<RateLimitResult>;
}

const MAX_TRACKED_KEYS = 10_000;

export function createMemoryRateLimiter(options: { limit: number; windowMs: number }): RateLimiter {
  const windows = new Map<string, { count: number; resetAt: number }>();

  function prune(now: number): void {
    for (const [key, window] of windows) {
      if (window.resetAt <= now) windows.delete(key);
    }
  }

  return {
    async consume(key) {
      const now = Date.now();
      if (windows.size >= MAX_TRACKED_KEYS) prune(now);

      let window = windows.get(key);
      if (!window || window.resetAt <= now) {
        window = { count: 0, resetAt: now + options.windowMs };
        windows.set(key, window);
      }
      window.count += 1;

      return {
        allowed: window.count <= options.limit,
        limit: options.limit,
        remaining: Math.max(0, options.limit - window.count),
        resetAt: window.resetAt,
      };
    },
  };
}

/**
 * Only trustworthy behind a proxy that overwrites X-Forwarded-For (e.g. Vercel, Nginx).
 */
export function getClientIdentifier(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "anonymous";
}
