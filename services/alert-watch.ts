import "server-only";
import {
  DEFAULT_ALERT_VENUES,
  DEFAULT_MUTED_POCKET,
  normalizeAlertVenues,
  normalizeMutedPocket,
} from "@/lib/alerts/watch-venues";
import type { PocketSymbol } from "@/lib/alerts/watch-venues";
import type { MarketVenue } from "@/lib/config/market";
import { getDb } from "@/lib/db";
import { logger } from "@/lib/logger";

const ROW_ID = "default";

export interface AlertWatchState {
  venues: MarketVenue[];
  /** Pocket symbols that must not send a Telegram message. */
  muted: PocketSymbol[];
}

interface WatchGlobal {
  __alertWatch?: AlertWatchState;
}

function store(): WatchGlobal {
  return globalThis as WatchGlobal;
}

function defaults(): AlertWatchState {
  return { venues: [...DEFAULT_ALERT_VENUES], muted: [...DEFAULT_MUTED_POCKET] };
}

function fromJson(venues: unknown, muted: unknown): AlertWatchState {
  return {
    venues: Array.isArray(venues) ? normalizeAlertVenues(venues.map(String)) : [...DEFAULT_ALERT_VENUES],
    muted: Array.isArray(muted) ? normalizeMutedPocket(muted.map(String)) : [...DEFAULT_MUTED_POCKET],
  };
}

async function readDb(): Promise<AlertWatchState | null> {
  try {
    const row = await getDb().alertWatch.findUnique({ where: { id: ROW_ID } });
    if (!row) return null;
    return fromJson(row.venues, row.muted);
  } catch (error) {
    logger.warn("alert_watch_read_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function getAlertWatch(): Promise<AlertWatchState> {
  const saved = store().__alertWatch;
  if (saved) return { venues: [...saved.venues], muted: [...saved.muted] };
  const state = (await readDb()) ?? defaults();
  store().__alertWatch = state;
  return { venues: [...state.venues], muted: [...state.muted] };
}

export async function getAlertVenues(): Promise<MarketVenue[]> {
  return (await getAlertWatch()).venues;
}

export async function getMutedPocket(): Promise<PocketSymbol[]> {
  return (await getAlertWatch()).muted;
}

export async function setAlertWatch(
  venuesInput: readonly string[],
  mutedInput: readonly string[],
): Promise<AlertWatchState> {
  const state: AlertWatchState = {
    venues: normalizeAlertVenues(venuesInput),
    muted: normalizeMutedPocket(mutedInput),
  };
  store().__alertWatch = state;
  try {
    await getDb().alertWatch.upsert({
      where: { id: ROW_ID },
      create: { id: ROW_ID, venues: state.venues, muted: state.muted },
      update: { venues: state.venues, muted: state.muted },
    });
  } catch (error) {
    // Keep the in-memory switch so this instance still watches the chosen venues.
    logger.warn("alert_watch_write_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return { venues: [...state.venues], muted: [...state.muted] };
}
