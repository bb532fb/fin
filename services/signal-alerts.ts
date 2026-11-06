import "server-only";
import { ALERT_TICK_OFFSET_MS, TELEGRAM_WELCOME, formatTradeAlert, msUntilMinuteSlot } from "@/lib/alerts/format-alert";
import { nextAlertState, toAlertDirection } from "@/lib/alerts/next-alerts";
import type { AlertCandidate } from "@/lib/alerts/next-alerts";
import type { MarketVenue } from "@/lib/config/market";
import { describeError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { getAlertVenues, getMutedPocket } from "@/services/alert-watch";
import { marketScanner } from "@/services/scanner";
import { findTelegramChatId, sendTelegramMessage } from "@/services/telegram";
import type { ScanItem } from "@/lib/schemas/scan";

const ALERT_TIMEFRAMES = ["1m", "3m", "5m"] as const;
/** A stuck Binance call must not silence every later minute. */
const TICK_BUDGET_MS = 50_000;

interface AlertGlobal {
  __finSignalAlerts?: boolean;
  __finSignalRun?: () => Promise<void>;
  __finWelcomed?: boolean;
  __finChatId?: string | null;
  __finAlertState?: Map<string, string>;
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

/**
 * While the app is running, checks the venues chosen on the site every minute.
 * Sends one Telegram message when a pair newly says up or down at 75 or above,
 * and only when the higher chart is the same side. No message otherwise.
 * Replacing `__finSignalRun` lets a reload pick up this rule without a second timer.
 */
export function startSignalAlerts(): void {
  const globalState = globalThis as AlertGlobal;
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) return;

  const memory = globalThis as AlertGlobal;
  memory.__finChatId ??= process.env.TELEGRAM_CHAT_ID?.trim() || null;
  memory.__finWelcomed ??= Boolean(memory.__finChatId);
  memory.__finAlertState ??= new Map();
  let runningSince = 0;
  let generation = 0;

  async function tick(): Promise<void> {
    const now = Date.now();
    if (runningSince !== 0 && now - runningSince < TICK_BUDGET_MS) return;
    if (runningSince !== 0) logger.warn("signal_alerts_tick_overran");
    const mine = ++generation;
    runningSince = now;
    try {
      if (!token) return;
      if (!memory.__finChatId) memory.__finChatId = await findTelegramChatId(token);
      const chatId = memory.__finChatId;
      if (!chatId) return;
      if (!memory.__finWelcomed) {
        memory.__finWelcomed = await sendTelegramMessage(token, chatId, TELEGRAM_WELCOME);
      }
      const venues = await getAlertVenues();
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
      const next = nextAlertState(memory.__finAlertState ?? new Map(), found);
      memory.__finAlertState = next.state;
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
    } catch (error) {
      logger.warn("signal_alerts_failed", { error: describeError(error) });
    } finally {
      if (generation === mine) runningSince = 0;
    }
  }

  globalState.__finSignalRun = tick;
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
