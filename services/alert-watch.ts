import "server-only";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  DEFAULT_ALERT_VENUES,
  DEFAULT_MUTED_POCKET,
  normalizeAlertVenues,
  normalizeMutedPocket,
} from "@/lib/alerts/watch-venues";
import type { PocketSymbol } from "@/lib/alerts/watch-venues";
import type { MarketVenue } from "@/lib/config/market";

const FILE = path.join(process.cwd(), ".data", "alert-watch.json");

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

function readFile(): AlertWatchState | null {
  try {
    const parsed = JSON.parse(readFileSync(FILE, "utf8")) as { venues?: unknown; muted?: unknown };
    if (!Array.isArray(parsed.venues)) return null;
    return {
      venues: normalizeAlertVenues(parsed.venues.map(String)),
      muted: Array.isArray(parsed.muted)
        ? normalizeMutedPocket(parsed.muted.map(String))
        : [...DEFAULT_MUTED_POCKET],
    };
  } catch {
    return null;
  }
}

export function getAlertWatch(): AlertWatchState {
  const saved = store().__alertWatch;
  if (saved) return { venues: [...saved.venues], muted: [...saved.muted] };
  const state = readFile() ?? { venues: [...DEFAULT_ALERT_VENUES], muted: [...DEFAULT_MUTED_POCKET] };
  store().__alertWatch = state;
  return { venues: [...state.venues], muted: [...state.muted] };
}

export function getAlertVenues(): MarketVenue[] {
  return getAlertWatch().venues;
}

export function getMutedPocket(): PocketSymbol[] {
  return getAlertWatch().muted;
}

export function setAlertWatch(venuesInput: readonly string[], mutedInput: readonly string[]): AlertWatchState {
  const state: AlertWatchState = {
    venues: normalizeAlertVenues(venuesInput),
    muted: normalizeMutedPocket(mutedInput),
  };
  store().__alertWatch = state;
  mkdirSync(path.dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify(state));
  return { venues: [...state.venues], muted: [...state.muted] };
}
