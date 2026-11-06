import { Card } from "@/components/ui/card";

const STEPS = [
  "Շուկայի candle-ներ",
  "Indicator-ների հաշվարկ",
  "Signal պայմանների գնահատում",
  "Բացատրության գրում",
];

const PLACEHOLDER_TILES = ["price", "entry", "stop", "target", "ratio"];

export function AnalysisSkeleton() {
  return (
    <Card className="flex flex-col gap-6 p-6 animate-fade-up" as="div">
      <div role="status" className="flex flex-col gap-3">
        <span className="sr-only">Վերլուծությունը ընթացքում է</span>
        <div className="h-4 w-32 animate-pulse rounded bg-surface-raised" />
        <div className="h-12 w-56 animate-pulse rounded bg-surface-raised shadow-[0_0_24px_rgb(34_211_238_/_0.08)]" />
        <div className="h-3 w-full animate-pulse rounded-full bg-surface-raised" />
      </div>
      <ol className="grid gap-2 text-sm text-muted sm:grid-cols-4">
        {STEPS.map((step) => (
          <li key={step} className="flex items-center gap-2">
            <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-accent-glow" />
            {step}
          </li>
        ))}
      </ol>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {PLACEHOLDER_TILES.map((tile) => (
          <div key={tile} className="h-20 animate-pulse rounded-xl border border-border/60 bg-surface-raised/70" />
        ))}
      </div>
    </Card>
  );
}
