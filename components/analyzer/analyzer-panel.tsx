"use client";

import { useEffect, useRef, useState } from "react";
import { AnalysisSkeleton } from "@/components/analyzer/analysis-skeleton";
import { AnalyzerForm } from "@/components/analyzer/analyzer-form";
import { ResultCard } from "@/components/analyzer/result-card";
import { ScannerPanel } from "@/components/scanner/scanner-panel";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { AlertWatch } from "@/components/analyzer/alert-watch";
import { MarketSwitch } from "@/components/analyzer/market-switch";
import { requestAnalysis } from "@/lib/api-client";
import { coerceSymbol, coerceTimeframe, formatSymbolPair } from "@/lib/config/market";
import { formatSignedPercent } from "@/lib/format";
import type { MarketVenue, PocketBook, SupportedSymbol, Timeframe } from "@/lib/config/market";
import type { AnalysisResult, AnalyzeRequest } from "@/types/analysis";

type AnalysisState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; result: AnalysisResult }
  | { status: "error"; message: string };

export function AnalyzerPanel() {
  const [venue, setVenue] = useState<MarketVenue>("spot");
  const [pocketBook, setPocketBook] = useState<PocketBook>("market");
  const [symbol, setSymbol] = useState<SupportedSymbol>("BTCUSDT");
  const [timeframe, setTimeframe] = useState<Timeframe>("15m");
  const [state, setState] = useState<AnalysisState>({ status: "idle" });
  const controllerRef = useRef<AbortController | null>(null);

  const pocketOtc = venue === "pocket" && pocketBook === "otc";

  function changeVenue(next: MarketVenue) {
    controllerRef.current?.abort();
    setVenue(next);
    setSymbol((current) => coerceSymbol(next, current));
    setTimeframe((current) => coerceTimeframe(next, current));
    setState({ status: "idle" });
  }

  function changePocketBook(next: PocketBook) {
    controllerRef.current?.abort();
    setPocketBook(next);
    setState({ status: "idle" });
  }

  useEffect(() => () => controllerRef.current?.abort(), []);

  async function analyze(request: AnalyzeRequest) {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState({ status: "loading" });
    try {
      const result = await requestAnalysis(request, controller.signal);
      setState({ status: "success", result });
    } catch (error) {
      if (controller.signal.aborted) return;
      const message =
        error instanceof Error ? error.message : "Վերլուծությունը ձախողվեց։ Փորձիր նորից։";
      setState({ status: "error", message });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <MarketSwitch
        value={venue}
        pocketBook={pocketBook}
        disabled={state.status === "loading"}
        onChange={changeVenue}
        onPocketBookChange={changePocketBook}
      />
      <AlertWatch />

      {state.status === "success" && (
        <div className="-mt-4 flex justify-end animate-fade-up">
          <Badge tone={state.result.priceChangePct >= 0 ? "long" : "short"}>
            {formatSymbolPair(state.result.symbol)} {formatSignedPercent(state.result.priceChangePct)}
          </Badge>
        </div>
      )}

      <Card className="animate-fade-up p-6 sm:p-8">
        <AnalyzerForm
          venue={venue}
          pocketOtc={pocketOtc}
          symbol={symbol}
          timeframe={timeframe}
          loading={state.status === "loading"}
          onSymbolChange={setSymbol}
          onTimeframeChange={setTimeframe}
          onSubmit={() => analyze({ symbol, timeframe, market: venue })}
        />
      </Card>

      <div aria-live="polite" className="flex flex-col gap-6">
        {state.status === "loading" && <AnalysisSkeleton />}
        {state.status === "error" && (
          <Card as="div" className="border-short/30 p-6">
            <p role="alert" className="text-sm text-short">
              {state.message}
            </p>
          </Card>
        )}
        {state.status === "success" && <ResultCard result={state.result} venue={venue} />}
      </div>

      <div className="border-t border-border/60 pt-6">
        <ScannerPanel
          key={`${venue}:${pocketBook}:${timeframe}`}
          venue={venue}
          pocketOtc={pocketOtc}
          timeframe={timeframe}
          disabled={state.status === "loading" || pocketOtc}
          onPick={(pickedSymbol, pickedTimeframe) => {
            setSymbol(pickedSymbol);
            setTimeframe(pickedTimeframe);
            void analyze({ symbol: pickedSymbol, timeframe: pickedTimeframe, market: venue });
          }}
        />
      </div>
    </div>
  );
}
