"use client";

import { Card } from "@/components/ui/card";

export default function HistoryError({ retry }: { error: Error; retry: () => void }) {
  return (
    <Card className="flex flex-col items-start gap-4 p-6">
      <p className="text-short">Պատմությունը ժամանակավորապես հասանելի չէ։ Փորձիր մի փոքր ուշ։</p>
      <button
        type="button"
        onClick={retry}
        className="rounded-lg border border-border-strong px-3 py-1.5 text-sm hover:border-accent"
      >
        Կրկին փորձել
      </button>
    </Card>
  );
}
