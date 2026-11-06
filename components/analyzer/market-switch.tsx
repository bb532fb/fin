"use client";

import type { MarketVenue, PocketBook } from "@/lib/config/market";

interface MarketSwitchProps {
  value: MarketVenue;
  pocketBook: PocketBook;
  disabled: boolean;
  onChange: (venue: MarketVenue) => void;
  onPocketBookChange: (book: PocketBook) => void;
}

const OPTIONS: readonly { value: MarketVenue; label: string }[] = [
  { value: "spot", label: "Spot" },
  { value: "futures", label: "Futures" },
  { value: "pocket", label: "Pocket Option" },
];

const BOOKS: readonly { value: PocketBook; label: string }[] = [
  { value: "market", label: "Ոչ OTC" },
  { value: "otc", label: "OTC" },
];

function caption(value: MarketVenue, book: PocketBook): string {
  if (value === "futures") return "USDT-M perpetual։ Գրաֆիկը րոպեներով է, պատասխանը՝ UP կամ DOWN։";
  if (value === "pocket" && book === "otc") {
    return "OTC գինը միայն Pocket Option-ի սերվերում է։ Այդ գիրքով վերլուծություն չկա։";
  }
  if (value === "pocket") {
    return "Ոչ OTC կրիպտո՝ իրական շուկայի գնով։ Պատասխանը՝ UP կամ DOWN և քանի րոպեով դնել։";
  }
  return "Spot գնում-վաճառք, առանց leverage-ի։";
}

export function MarketSwitch({
  value,
  pocketBook,
  disabled,
  onChange,
  onPocketBookChange,
}: MarketSwitchProps) {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-3">
      <div
        role="group"
        aria-label="Շուկա"
        className="grid w-full grid-cols-3 rounded-2xl border border-border-strong bg-surface-raised/70 p-1"
      >
        {OPTIONS.map((option) => {
          const active = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              disabled={disabled}
              onClick={() => onChange(option.value)}
              className={`h-11 rounded-xl px-2 text-xs font-bold tracking-wide transition disabled:opacity-60 sm:text-sm ${
                active
                  ? "bg-gradient-to-r from-accent to-violet text-white shadow-[0_0_18px_rgb(61_139_253_/_0.35)]"
                  : "text-muted hover:text-text"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {value === "pocket" && (
        <div
          role="group"
          aria-label="Pocket Option գիրք"
          className="grid w-full max-w-xs grid-cols-2 rounded-xl border border-border bg-surface/80 p-1"
        >
          {BOOKS.map((option) => {
            const active = pocketBook === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                disabled={disabled}
                onClick={() => onPocketBookChange(option.value)}
                className={`h-9 rounded-lg text-sm font-semibold transition disabled:opacity-60 ${
                  active ? "bg-surface-raised text-text" : "text-muted hover:text-text"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}
      <p className="text-center text-xs text-subtle">{caption(value, pocketBook)}</p>
    </div>
  );
}
