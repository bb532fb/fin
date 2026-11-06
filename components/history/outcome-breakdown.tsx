import { Card, CardTitle } from "@/components/ui/card";
import type { BreakdownRow, OutcomeBreakdown } from "@/services/analysis-repository";

function rateText(row: BreakdownRow): string {
  if (row.winRate === null) return "—";
  return `${(row.winRate * 100).toFixed(0)}%`;
}

function Section({ title, rows }: { title: string; rows: BreakdownRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-sm text-muted">Դեռ փակված Հաղթ/Պարտ չկա այս խմբում։</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      <ul className="flex flex-col gap-1.5 text-sm">
        {rows.map((row) => (
          <li
            key={row.key}
            className="flex flex-wrap items-center justify-between gap-2 border-t border-border py-2 first:border-t-0 first:pt-0"
          >
            <span className="font-medium">{row.label}</span>
            <span className="font-mono text-xs text-muted tabular-nums">
              Հաղթ {row.wins} · Պարտ {row.losses} · {rateText(row)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function OutcomeBreakdownCard({ breakdown }: { breakdown: OutcomeBreakdown }) {
  const empty =
    breakdown.byDirection.length === 0 &&
    breakdown.byTimeframe.length === 0 &&
    breakdown.byConfidence.length === 0;

  return (
    <Card className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <CardTitle>Որոնք են ավելի ճիշտ</CardTitle>
        <p className="text-sm text-muted">
          Միայն փակված Հաղթ/Պարտ signal-ներ։ Սա օգնում է տեսնել՝ որ ուղղությունը, timeframe-ը կամ
          ուժը ավելի լավ է աշխատում։
        </p>
      </div>
      {empty ? (
        <p className="text-sm text-caution">
          Դեռ բավարար փակված գործարք չկա։ Արա վերլուծություններ և սպասիր, որ Status-ը դառնա Հաղթ կամ
          Պարտ։
        </p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-3">
          <Section title="Ըստ ուղղության" rows={breakdown.byDirection} />
          <Section title="Ըստ ժամանակաշրջանի" rows={breakdown.byTimeframe} />
          <Section title="Ըստ ուժի" rows={breakdown.byConfidence} />
        </div>
      )}
    </Card>
  );
}
