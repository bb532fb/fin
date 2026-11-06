"use client";

import { useId, useState } from "react";
import { Stat } from "@/components/ui/stat";
import { POSITION_SIZING } from "@/lib/config/trading";
import { coinOf } from "@/lib/guidance/action-guide";
import { sizePosition } from "@/lib/trading/position-size";
import type { TradeAnalysisResult } from "@/types/analysis";

const usd = (value: number) => `${value.toLocaleString("en-US", { maximumFractionDigits: 2 })} USDT`;

function NumberField(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  max?: number;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-xs font-medium uppercase tracking-wider text-muted">
        {props.label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={0}
        max={props.max}
        step="any"
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        className="h-12 rounded-xl border border-border-strong bg-surface-raised px-4 font-mono text-sm text-text outline-none transition focus:border-accent"
      />
    </div>
  );
}

export function PositionCalculator({ result }: { result: TradeAnalysisResult }) {
  const [capital, setCapital] = useState("");
  const [riskPct, setRiskPct] = useState(String(POSITION_SIZING.defaultRiskPct));
  const risk = Math.min(Number(riskPct), POSITION_SIZING.maxRiskPct);
  const size = sizePosition({
    capital: Number(capital),
    riskPct: risk,
    entry: result.entry.max,
    stopLoss: result.stopLoss,
    takeProfit: result.takeProfit,
    quantityStep: result.quantityStep,
    minNotional: result.minNotional,
    feeRate: POSITION_SIZING.feeRate,
  });
  const coin = coinOf(result.symbol);

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface-raised/40 p-4">
      <p className="text-sm font-semibold">Որքա՞ն գնել</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField label="Քո կապիտալը (USDT)" value={capital} onChange={setCapital} />
        <NumberField
          label={`Ռիսկ մեկ գործարքում (%, առավելագույնը ${POSITION_SIZING.maxRiskPct})`}
          value={riskPct}
          onChange={setRiskPct}
          max={POSITION_SIZING.maxRiskPct}
        />
      </div>
      {size && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label={`Քանակ (${coin})`} value={size.quantityText} valueClassName="text-accent" />
            <Stat label="Order-ի արժեք" value={usd(size.notional)} />
            <Stat label="Առավելագույն կորուստ" value={usd(size.maxLoss)} valueClassName="text-short" />
            <Stat label="Հնարավոր շահույթ" value={usd(size.potentialProfit)} valueClassName="text-long" />
          </div>
          {size.belowMinNotional && (
            <p className="text-sm text-short">
              Order-ը շատ փոքր է. Binance-ը չի ընդունի {usd(result.minNotional)}-ից փոքր order։
            </p>
          )}
          {size.cappedByCapital && (
            <p className="text-sm text-caution">
              Stop Loss-ը շատ մոտ է, դրա համար քանակը սահմանափակված է քո կապիտալով։
            </p>
          )}
        </>
      )}
      <p className="text-xs leading-relaxed text-subtle">
        Հաշվարկը վերցնում է entry zone-ի ամենավատ գինը և Binance-ի 0.1% միջնորդավճարը։ Եթե Stop
        Loss-ը կպնի, կկորցնես ոչ ավելի, քան կապիտալի {risk > 0 ? risk : "—"}%-ը։
      </p>
    </div>
  );
}
