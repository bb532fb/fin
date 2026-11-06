"use client";

import { useEffect, useRef, useState } from "react";
import { DEFAULT_MUTED_POCKET } from "@/lib/alerts/watch-venues";
import type { PocketSymbol } from "@/lib/alerts/watch-venues";
import { MARKETS, POCKET_SYMBOLS, formatSymbolPair } from "@/lib/config/market";
import type { MarketVenue } from "@/lib/config/market";

type WatchDraft = { venues: MarketVenue[]; muted: PocketSymbol[] };

const OPTIONS: readonly { value: MarketVenue; label: string }[] = [
  { value: "spot", label: "Spot" },
  { value: "futures", label: "Futures" },
  { value: "pocket", label: "Pocket" },
];

export function AlertWatch() {
  const [venues, setVenues] = useState<MarketVenue[]>(["futures"]);
  const [muted, setMuted] = useState<PocketSymbol[]>([...DEFAULT_MUTED_POCKET]);
  const [ready, setReady] = useState(false);
  const latest = useRef<WatchDraft>({ venues: ["futures"], muted: [...DEFAULT_MUTED_POCKET] });
  const committed = useRef<WatchDraft>({ venues: ["futures"], muted: [...DEFAULT_MUTED_POCKET] });
  const dirty = useRef(false);
  const writing = useRef(false);
  const touched = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/alerts", { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { venues?: MarketVenue[]; muted?: PocketSymbol[] } | null) => {
        if (!body?.venues || touched.current) return;
        const next = { venues: body.venues, muted: body.muted ?? [...DEFAULT_MUTED_POCKET] };
        latest.current = next;
        committed.current = next;
        setVenues(next.venues);
        setMuted(next.muted);
      })
      .catch(() => undefined)
      .finally(() => setReady(true));
    return () => controller.abort();
  }, []);

  function publish(nextVenues: MarketVenue[], nextMuted: PocketSymbol[]) {
    touched.current = true;
    latest.current = { venues: nextVenues, muted: nextMuted };
    setVenues(nextVenues);
    setMuted(nextMuted);
    dirty.current = true;
    void flush();
  }

  async function flush() {
    if (writing.current) return;
    writing.current = true;
    try {
      while (dirty.current) {
        dirty.current = false;
        const body = { venues: latest.current.venues, muted: latest.current.muted };
        const response = await fetch("/api/alerts", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!response.ok) {
          if (!dirty.current) {
            latest.current = committed.current;
            setVenues(committed.current.venues);
            setMuted(committed.current.muted);
          }
          break;
        }
        committed.current = body;
      }
    } finally {
      writing.current = false;
      if (dirty.current) void flush();
    }
  }

  function toggle(venue: MarketVenue) {
    const current = latest.current;
    const next = current.venues.includes(venue)
      ? current.venues.filter((item) => item !== venue)
      : [...current.venues, venue];
    publish(MARKETS.filter((item) => next.includes(item)), current.muted);
  }

  function toggleMuted(symbol: PocketSymbol) {
    const current = latest.current;
    const next = current.muted.includes(symbol)
      ? current.muted.filter((item) => item !== symbol)
      : [...current.muted, symbol];
    publish(current.venues, next);
  }

  const allOn = OPTIONS.every((option) => venues.includes(option.value));
  const buttonClass = (active: boolean) =>
    `h-9 rounded-xl text-xs font-semibold transition disabled:opacity-60 sm:text-sm ${
      active ? "bg-surface-raised text-text" : "bg-short/15 text-short"
    }`;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-2">
      <p className="text-xs font-semibold text-muted">Telegram-ը նայի</p>
      <div className="grid w-full grid-cols-4 gap-1 rounded-2xl border border-border bg-surface/80 p-1">
        {OPTIONS.map((option) => {
          const active = venues.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              disabled={!ready}
              onClick={() => toggle(option.value)}
              className={buttonClass(active)}
            >
              {option.label}
            </button>
          );
        })}
        <button
          type="button"
          aria-pressed={allOn}
          disabled={!ready}
          onClick={() => publish(allOn ? [] : [...MARKETS], latest.current.muted)}
          className={buttonClass(allOn)}
        >
          Բոլորը
        </button>
      </div>
      {venues.includes("pocket") && (
        <div className="flex w-full flex-col items-center gap-2">
          <p className="text-center text-xs text-subtle">Աստղիկը անջատում է այդ զույգի հաղորդագրությունը։</p>
          <div className="flex w-full flex-wrap justify-center gap-1">
            {POCKET_SYMBOLS.map((symbol) => {
              const off = muted.includes(symbol);
              return (
                <button
                  key={symbol}
                  type="button"
                  aria-pressed={off}
                  aria-label={`${formatSymbolPair(symbol)} ${off ? "անջատված" : "միացված"}`}
                  disabled={!ready}
                  onClick={() => toggleMuted(symbol)}
                  className={`flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition disabled:opacity-60 sm:text-sm ${
                    off ? "bg-short/15 text-short" : "bg-surface-raised text-text"
                  }`}
                >
                  <span aria-hidden>{off ? "★" : "☆"}</span>
                  {formatSymbolPair(symbol)}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <p className="text-center text-xs text-subtle">
        Ամեն րոպե նայում է 1, 3 և 5 րոպեի գրաֆիկները։ Pocket Option-ը միայն ոչ OTC է։
      </p>
    </div>
  );
}
