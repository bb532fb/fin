import { Badge } from "@/components/ui/badge";
import { CpuIcon } from "@/components/ui/icons";
import { formatPrice } from "@/lib/format";
import type { AnalysisResult } from "@/types/analysis";

interface AiAnalysisProps {
  analysis: AnalysisResult["analysis"];
  result: AnalysisResult;
}

export function AiAnalysis({ analysis, result }: AiAnalysisProps) {
  const isAi = analysis.source === "AI";
  const sellHint =
    result.direction === "NO_TRADE" ? (
      <span className="text-text/90">
        {"Հիմա գործարք չդիր։ Վաճառքի գին չկա, որովհետև մուտք չկա։"}
      </span>
    ) : (
      <span className="text-text/90">
        {"Վաճառիր շահույթով՝ "}
        <span className="font-semibold text-text">
          {formatPrice(result.takeProfit, result.pricePrecision)}
        </span>{" "}
        (Take profit)։ {"Վաճառիր/փակիր կորուստով՝ "}
        <span className="font-semibold text-text">
          {formatPrice(result.stopLoss, result.pricePrecision)}
        </span>{" "}
        (Stop loss)։ {"Ժամանակով մի վաճառիր։"}
      </span>
    );
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <span
          aria-hidden
          className="grid size-10 place-items-center rounded-xl border border-violet/40 bg-violet/20 text-violet shadow-glow-violet"
        >
          <CpuIcon />
        </span>
        <h3 className="text-lg font-semibold">{"AI վերլուծություն"}</h3>
        <Badge tone={isAi ? "accent" : "muted"}>
          {isAi ? "AI բացատրություն" : "Կանոնների բացատրություն"}
        </Badge>
      </div>
      <p className="rounded-xl border border-accent/25 bg-bg/40 px-4 py-3 text-sm leading-relaxed">
        <span className="font-medium text-accent-glow">{"Երբ վաճառել. "}</span>
        {sellHint}
      </p>
      <p className="leading-relaxed text-text/90">{analysis.summary}</p>
      <ul className="flex flex-col gap-2">
        {analysis.reasoning.map((reason) => (
          <li key={reason} className="flex gap-3 text-sm leading-relaxed text-muted">
            <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-accent-glow" />
            {reason}
          </li>
        ))}
      </ul>
      <p className="rounded-xl border border-caution/25 bg-caution/5 p-3 text-sm text-muted">
        <span className="font-medium text-caution">{"Ռիսկ. "}</span>
        {analysis.riskWarning}
      </p>
      {!isAi && (
        <p className="text-xs text-subtle">
          {
            "AI բացատրությունը հասանելի չէր, ուստի այս ամփոփումը գեներացվել է հաշվարկված պայմաններից։"
          }
        </p>
      )}
    </div>
  );
}
