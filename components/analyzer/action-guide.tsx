import Link from "next/link";
import { TONE_TEXT } from "@/components/ui/badge";
import { IconTile } from "@/components/ui/icon-tile";
import { TargetIcon } from "@/components/ui/icons";
import type { MarketVenue } from "@/lib/config/market";
import { buildActionGuide } from "@/lib/guidance/action-guide";
import type { AnalysisResult } from "@/types/analysis";

export function ActionGuide({ result, venue }: { result: AnalysisResult; venue: MarketVenue }) {
  const guide = buildActionGuide(result, venue);
  const borderTone =
    guide.tone === "long"
      ? "border-long/35 bg-long/5"
      : guide.tone === "short"
        ? "border-short/35 bg-short/5"
        : "border-caution/35 bg-caution/5";

  return (
    <div className={`flex flex-col gap-4 rounded-xl border p-4 sm:p-5 ${borderTone}`}>
      <div className="flex items-center gap-4">
        <IconTile tone={guide.tone} size="lg">
          <TargetIcon />
        </IconTile>
        <div className="flex flex-col gap-1">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Ի՞նչ անել</h2>
          <p className={`text-xl font-bold sm:text-2xl ${TONE_TEXT[guide.tone]}`}>{guide.title}</p>
        </div>
      </div>
      <p className="text-sm leading-relaxed text-muted">{guide.summary}</p>
      {guide.warnings.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm text-caution">
          {guide.warnings.map((warning) => (
            <li key={warning}>⚠ {warning}</li>
          ))}
        </ul>
      )}
      <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm leading-relaxed">
        {guide.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <p className="text-xs leading-relaxed text-subtle">
        Իրական գումար դնելուց առաջ{" "}
        <Link href="/history" className="text-accent-glow underline underline-offset-2">
          Պատմություն
        </Link>
        -ում ստուգիր signal-ների արդյունքները։ Մի դիր ավելին, քան պատրաստ ես կորցնել։
      </p>
    </div>
  );
}
