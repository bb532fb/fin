import "server-only";
import { ALERT_TICK_OFFSET_MS, TELEGRAM_WELCOME, formatTradeAlert, msUntilMinuteSlot } from "@/lib/alerts/format-alert";
import { nextAlertState, toAlertDirection } from "@/lib/alerts/next-alerts";
import type { AlertCandidate } from "@/lib/alerts/next-alerts";
import type { MarketVenue } from "@/lib/config/market";
import { describeError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import {
  claimAlertTick,
  getAlertSignalState,
  getAlertVenues,
  getMutedPocket,
  saveAlertSignalState,
} from "@/services/alert-watch";
import { marketScanner } from "@/services/scanner";
import { findTelegramChatId, sendTelegramMessage } from "@/services/telegram";
import type { ScanItem } from "@/lib/schemas/scan";

const ALERT_TIMEFRAMES = ["1m", "3m", "5m"] as const;
/** A stuck Binance call must not silence every later minute. */
const TICK_BUDGET_MS = 50_000;
/** Cross-instance lock so browser + cron do not double-scan. */
const TICK_CLAIM_MS = 50_000;

interface AlertGlobal {
  __finSignalAlerts?: boolean;
  __finSignalRun?: () => Promise<SignalAlertTickResult>;
  __finWelcomed?: boolean;
  __finChatId?: string | null;
  __finAlertRunningSince?: number;
  __finAlertGeneration?: number;
}

function actionable(item: ScanItem): AlertCandidate["direction"] {
  return toAlertDirection(item);
}

interface PendingAlert extends AlertCandidate {
  venue: MarketVenue;
  symbol: string;
  timeframe: (typeof ALERT_TIMEFRAMES)[number];
  confidence: number;
}

export interface SignalAlertTickResult {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  pairs?: number;
  trades?: number;
  failedScans?: number;
}

/**
 * One alert pass: scan watched venues, send Telegram only for new 60+ aligned trades.
 * Safe to call from a cron/route on Vercel — does not rely on a long-lived timer.
 */
export async function runSignalAlertTick(): Promise<SignalAlertTickResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    logger.warn("signal_alerts_disabled", { reason: "missing_telegram_token" });
    return { ok: false, reason: "missing_telegram_token" };
  }

  const memory = globalThis as AlertGlobal;
  const now = Date.now();
  if (memory.__finAlertRunningSince && now - memory.__finAlertRunningSince < TICK_BUDGET_MS) {
    return { ok: true, skipped: true, reason: "in_flight" };
  }
  if (!(await claimAlertTick(TICK_CLAIM_MS))) {
    return { ok: true, skipped: true, reason: "claimed" };
  }

  const mine = (memory.__finAlertGeneration = (memory.__finAlertGeneration ?? 0) + 1);
  memory.__finAlertRunningSince = now;
  memory.__finChatId ??= process.env.TELEGRAM_CHAT_ID?.trim() || null;
  memory.__finWelcomed ??= Boolean(memory.__finChatId);

  try {
    if (!memory.__finChatId) memory.__finChatId = await findTelegramChatId(token);
    const chatId = memory.__finChatId;
    if (!chatId) {
      logger.warn("signal_alerts_disabled", { reason: "missing_chat_id" });
      return { ok: false, reason: "missing_chat_id" };
    }
    if (!memory.__finWelcomed) {
      memory.__finWelcomed = await sendTelegramMessage(token, chatId, TELEGRAM_WELCOME);
    }

    const venues = await getAlertVenues();
    if (venues.length === 0) {
      return { ok: true, pairs: 0, trades: 0, failedScans: 0, reason: "no_venues" };
    }
    const mutedPocket = new Set<string>(await getMutedPocket());
    const scans = await Promise.all(
      venues.flatMap((venue) =>
        ALERT_TIMEFRAMES.map(async (timeframe) => {
          try {
            const scan = await marketScanner.scan({ market: venue, timeframe });
            return { venue, timeframe, scan, error: null };
          } catch (error) {
            logger.warn("signal_alerts_scan_failed", {
              venue,
              timeframe,
              error: describeError(error),
            });
            return { venue, timeframe, scan: null, error };
          }
        }),
      ),
    );

    const found: PendingAlert[] = [];
    let failedScans = 0;
    for (const { venue, timeframe, scan } of scans) {
      if (!scan) {
        failedScans += 1;
        continue;
      }
      for (const item of scan.items) {
        if (venue === "pocket" && mutedPocket.has(item.symbol)) continue;
        found.push({
          id: `${venue}:${timeframe}:${item.symbol}`,
          venue,
          symbol: item.symbol,
          timeframe,
          confidence: item.confidence,
          direction: actionable(item),
        });
      }
    }

    const previous = await getAlertSignalState();
    const next = nextAlertState(previous, found);
    await saveAlertSignalState(next.state);

    logger.info("signal_alerts_checked", {
      pairs: found.length,
      trades: next.send.length,
      failedScans,
    });

    for (const alert of next.send) {
      const source = found.find((item) => item.id === alert.id);
      if (!source || (source.direction !== "LONG" && source.direction !== "SHORT")) continue;
      const text = formatTradeAlert({
        venue: source.venue,
        symbol: source.symbol,
        direction: source.direction,
        timeframe: source.timeframe,
        confidence: source.confidence,
      });
      logger.info("signal_alert_sent", { symbol: source.symbol, timeframe: source.timeframe, text });
      await sendTelegramMessage(token, chatId, text);
    }

    return {
      ok: true,
      pairs: found.length,
      trades: next.send.length,
      failedScans,
    };
  } catch (error) {
    logger.warn("signal_alerts_failed", { error: describeError(error) });
    return { ok: false, reason: describeError(error) };
  } finally {
    if (memory.__finAlertGeneration === mine) memory.__finAlertRunningSince = 0;
  }
}

/**
 * Local/dev only: keep a minute timer while the Node process stays alive.
 * On Vercel the process freezes after each request, so ticks come from `/api/alerts/tick`.
 */
export function startSignalAlerts(): void {
  const globalState = globalThis as AlertGlobal;
  globalState.__finSignalRun = runSignalAlertTick;
  if (process.env.VERCEL) return;
  if (!process.env.TELEGRAM_BOT_TOKEN?.trim()) return;
  if (globalState.__finSignalAlerts) return;
  globalState.__finSignalAlerts = true;

  const arm = (): void => {
    setTimeout(() => {
      void globalState.__finSignalRun?.().finally(() => {
        if ((globalThis as AlertGlobal).__finSignalAlerts) arm();
      });
    }, msUntilMinuteSlot(Date.now(), ALERT_TICK_OFFSET_MS));
  };
  arm();
}

startSignalAlerts();
