"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { formatSymbolPair, openForMinutes, symbolsFor, tradeDurationText } from "@/lib/config/market";
import type { MarketVenue, SupportedSymbol, Timeframe } from "@/lib/config/market";
import { requestScan } from "@/lib/api-client";
import { formatPrice, formatRatio } from "@/lib/format";
import type { Tone } from "@/lib/presentation";
import { scanVerdict } from "@/lib/scanner/rank";
import type { ScanVerdict } from "@/lib/scanner/rank";
import type { ScanItem, ScanResult } from "@/lib/schemas/scan";

function verdictDisplay(item: ScanItem): { label: string; tone: Tone } {
  const verdict: ScanVerdict = scanVerdict(item);
  if (verdict === "HIGH_RISK") return { label: "Բարձր ռիսկ", tone: "short" };
  if (verdict === "WAIT") return { label: "Սպասել", tone: "caution" };
  if (item.direction === "SHORT") return { label: "Ներքև (DOWN)", tone: "short" };
  return { label: "Վերև (UP)", tone: "long" };
}

type ScanState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; result: ScanResult }
  | { status: "error"; message: string };

function ScanRow({ item, disabled, onPick }: { item: ScanItem; disabled: boolean; onPick: () => void }) {
  const verdict = verdictDisplay(item);
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 border-t border-border py-3 first:border-t-0">
      <div className="flex flex-wrap items-center gap-3">
        <span className="w-24 font-semibold">{formatSymbolPair(item.symbol)}</span>
        <Badge tone={verdict.tone}>{verdict.label}</Badge>
        <span className="font-mono text-xs text-muted tabular-nums">
          {item.setupQuality ? `Setup ${item.setupQuality} · ` : ""}
          {item.confidence}/100 · R/R {formatRatio(item.riskReward)} ·{" "}
          {formatPrice(item.price, item.pricePrecision)}
        </span>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={onPick}
        className="text-sm font-semibold text-accent hover:underline disabled:opacity-50"
      >
        Մանրամասն →
      </button>
    </li>
  );
}

function Headline({ result, venue }: { result: ScanResult; venue: MarketVenue }) {
  const best = result.items[0];
  if (best && scanVerdict(best) === "CONSIDER") {
    if (venue === "futures" || venue === "pocket") {
      const where = venue === "pocket" ? "Pocket Option · ոչ OTC" : "Futures";
      const instruction =
        best.direction === "LONG" || best.direction === "SHORT"
          ? openForMinutes(best.direction, result.timeframe)
          : "";
      return (
        <p className="text-sm font-medium text-long">
          {where}։ Լավագույնը հիմա՝ {formatSymbolPair(best.symbol)} — {instruction}։ Բաց մանրամասն
          վերլուծությունը՝ գործելուց առաջ։
        </p>
      );
    }
    const side = best.direction === "SHORT" ? "ներքև" : "վերև";
    return (
      <p className="text-sm font-medium text-long">
        Լավագույն տարբերակը հիմա՝ {formatSymbolPair(best.symbol)} ({side})։ Բաց մանրամասն վերլուծությունը՝ գործելուց առաջ։
      </p>
    );
  }
  return (
    <p className="text-sm font-medium text-caution">
      {venue === "spot"
        ? "Հիմա ոչ մի զույգ չարժե։ Սպասիր և ստուգիր ավելի ուշ։"
        : `Հիմա ոչ մի զույգ չարժե ${tradeDurationText(result.timeframe)}ով։ Սպասիր և ստուգիր ավելի ուշ։`}
    </p>
  );
}

interface ScannerPanelProps {
  venue: MarketVenue;
  pocketOtc: boolean;
  timeframe: Timeframe;
  disabled: boolean;
  onPick: (symbol: SupportedSymbol, timeframe: Timeframe) => void;
}

export function ScannerPanel({ venue, pocketOtc, timeframe, disabled, onPick }: ScannerPanelProps) {
  const [state, setState] = useState<ScanState>({ status: "idle" });
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  async function scan() {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState({ status: "loading" });
    try {
      setState({ status: "success", result: await requestScan({ timeframe, market: venue }, controller.signal) });
    } catch (error) {
      if (controller.signal.aborted) return;
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Ստուգումը ձախողվեց։",
      });
    }
  }

  return (
    <Card className="flex flex-col gap-4 p-6 animate-fade-up">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <CardTitle>Որին դնեմ</CardTitle>
          <p className="text-sm text-muted">
            {pocketOtc
              ? "OTC գիրքով ստուգում չկա. Pocket Option-ի OTC գինը հանրային չէ։"
              : venue === "pocket"
                ? `Ստուգում է ${symbolsFor("pocket").map(formatSymbolPair).join(", ")} ${tradeDurationText(timeframe)}ով և ասում UP կամ DOWN։`
                : venue === "futures"
                  ? `Ստուգում է բոլոր futures զույգերը ${tradeDurationText(timeframe)} գրաֆիկով և ասում UP կամ DOWN։`
                  : `Ստուգում է բոլոր զույգերը ${timeframe} timeframe-ով՝ վերև և ներքև գործարքների համար։`}
          </p>
        </div>
        <Button type="button" loading={state.status === "loading"} disabled={disabled} onClick={scan}>
          {state.status === "loading" ? "Ստուգում եմ…" : "Ստուգել բոլորը"}
        </Button>
      </div>
      {state.status === "error" && <p role="alert" className="text-sm text-short">{state.message}</p>}
      {state.status === "success" && (
        <>
          <Headline result={state.result} venue={venue} />
          <ul>
            {state.result.items.map((item) => (
              <ScanRow
                key={item.symbol}
                item={item}
                disabled={disabled}
                onPick={() => onPick(item.symbol, state.result.timeframe)}
              />
            ))}
          </ul>
          {state.result.failed.length > 0 && (
            <p className="text-xs text-subtle">Չհաջողվեց ստուգել՝ {state.result.failed.map(formatSymbolPair).join(", ")}։</p>
          )}
        </>
      )}
    </Card>
  );
}
