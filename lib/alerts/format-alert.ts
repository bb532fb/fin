import { TIMEFRAME_MS, formatSymbolPair, openForMinutes } from "@/lib/config/market";
import type { MarketVenue, Timeframe } from "@/lib/config/market";

const YEREVAN = "Asia/Yerevan";

function venueLabel(venue: MarketVenue): string {
  if (venue === "pocket") return "Pocket Option · ոչ OTC";
  if (venue === "futures") return "Futures";
  return "Spot";
}

/**
 * The check runs as a minute starts, which is too late to open the trade.
 * Name the candle one minute ahead, and skip it if that one would already be almost over.
 */
const NOTICE_MS = 60_000;
const ENTRY_LEAD_MS = 25_000;

/** Scan starts just after the minute, so the message still names the next candle. */
export const ALERT_TICK_OFFSET_MS = 2_000;

/** Wait until `offsetMs` past the next minute boundary. */
export function msUntilMinuteSlot(now: number, offsetMs = ALERT_TICK_OFFSET_MS, periodMs = 60_000): number {
  const into = now % periodMs;
  let wait = offsetMs - into;
  if (wait < 1_000) wait += periodMs;
  return wait;
}

/** Candle to trade: one minute from now, or the one after if that minute is almost over. */
export function candleOpenAt(timeframe: Timeframe, now: Date): Date {
  const ms = TIMEFRAME_MS[timeframe];
  const t = now.getTime() + NOTICE_MS;
  const currentOpen = Math.floor(t / ms) * ms;
  if (currentOpen + ms - t >= ENTRY_LEAD_MS) return new Date(currentOpen);
  return new Date(currentOpen + ms);
}

function yerevanClock(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: YEREVAN,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  return `${hour}:${minute}`;
}

function instruction(
  venue: MarketVenue,
  direction: "LONG" | "SHORT",
  timeframe: Timeframe,
  at: Date,
): string {
  if (venue === "spot") return direction === "LONG" ? "Գնիր" : "Վաճառիր";
  const clock = yerevanClock(candleOpenAt(timeframe, at));
  const action = openForMinutes(direction, timeframe);
  return `${clock}-ից ${action.charAt(0).toLowerCase()}${action.slice(1)}`;
}

export function formatTradeAlert(input: {
  venue: MarketVenue;
  symbol: string;
  direction: "LONG" | "SHORT";
  timeframe: Timeframe;
  confidence: number;
  at?: Date;
}): string {
  return [
    venueLabel(input.venue),
    formatSymbolPair(input.symbol),
    instruction(input.venue, input.direction, input.timeframe, input.at ?? new Date()),
    `Ուժը՝ ${input.confidence}/100`,
  ].join("\n");
}

export const TELEGRAM_WELCOME =
  "Բոտը միացված է։ Կգրեմ միայն երբ ընտրված շուկայում գործարք լինի, և որ րոպեից բացել։ Եթե գործարք չկա, հաղորդագրություն չեմ ուղարկի։";
