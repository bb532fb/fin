import { AppError } from "@/lib/errors";
import { handleJson } from "@/lib/http";
import { runSignalAlertTick } from "@/services/signal-alerts";

export const maxDuration = 60;

/** Browser heartbeat or external cron (`Authorization: Bearer $CRON_SECRET`). */
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return true;
  if (request.headers.get("authorization") === `Bearer ${secret}`) return true;
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/**
 * One Telegram alert pass. The open site calls this every minute.
 * Hobby has no per-minute Vercel Cron — use an external cron with CRON_SECRET when the tab is closed.
 */
export function GET(request: Request): Promise<Response> {
  return handleJson("alert_tick_failed", async () => {
    if (!authorized(request)) throw new AppError("VALIDATION_ERROR", "Cron secret-ը սխալ է։");
    return runSignalAlertTick();
  });
}

export function POST(request: Request): Promise<Response> {
  return GET(request);
}
