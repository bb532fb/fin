import { Badge } from "@/components/ui/badge";
import { formatSymbolPair } from "@/lib/config/market";
import { formatDateTime, formatPrice, formatRatio, humanize } from "@/lib/format";
import { DIRECTION_LABEL, DIRECTION_TONE, STATUS_DISPLAY } from "@/lib/presentation";
import type { AnalysisHistoryItem } from "@/services/analysis-repository";

const HEADERS = ["Ժամանակ", "Շուկա", "Զույգ", "Ուղղություն", "Ուժ", "Գին", "Entry", "Stop", "Target", "R/R", "Կարգավիճակ"];

function venueLabel(market: string): string {
  if (market === "futures") return "Futures";
  if (market === "pocket") return "Pocket Option";
  return "Spot";
}

function directionLabel(item: AnalysisHistoryItem): string {
  if (item.market === "spot" || item.direction === "NO_TRADE") return DIRECTION_LABEL[item.direction];
  if (item.direction === "LONG") return "UP";
  return "DOWN";
}

function HistoryRow({ item }: { item: AnalysisHistoryItem }) {
  const p = item.pricePrecision;
  const entry =
    item.entryMin === null || item.entryMax === null
      ? "—"
      : `${formatPrice(item.entryMin, p)} – ${formatPrice(item.entryMax, p)}`;
  const status = STATUS_DISPLAY[item.status] ?? { label: humanize(item.status), tone: "muted" as const };
  return (
    <tr className="border-t border-border">
      <td className="whitespace-nowrap px-4 py-3 text-muted">{formatDateTime(item.createdAt)}</td>
      <td className="whitespace-nowrap px-4 py-3">{venueLabel(item.market)}</td>
      <td className="whitespace-nowrap px-4 py-3 font-medium">
        {formatSymbolPair(item.symbol)} <span className="text-subtle">{item.timeframe}</span>
      </td>
      <td className="px-4 py-3">
        <Badge tone={DIRECTION_TONE[item.direction]}>{directionLabel(item)}</Badge>
      </td>
      <td className="px-4 py-3 font-mono tabular-nums">{item.confidence}/100</td>
      <td className="px-4 py-3 font-mono tabular-nums">{formatPrice(item.price, p)}</td>
      <td className="whitespace-nowrap px-4 py-3 font-mono tabular-nums text-accent">{entry}</td>
      <td className="px-4 py-3 font-mono tabular-nums text-short">
        {item.market === "pocket" ? "—" : formatPrice(item.stopLoss, p)}
      </td>
      <td className="px-4 py-3 font-mono tabular-nums text-long">
        {item.market === "pocket" ? "—" : formatPrice(item.takeProfit, p)}
      </td>
      <td className="whitespace-nowrap px-4 py-3 font-mono tabular-nums">{formatRatio(item.riskReward)}</td>
      <td className="px-4 py-3">
        <Badge tone={status.tone}>{status.label}</Badge>
      </td>
    </tr>
  );
}

export function HistoryTable({ items }: { items: AnalysisHistoryItem[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-wider text-muted">
          <tr>
            {HEADERS.map((header) => (
              <th key={header} scope="col" className="whitespace-nowrap px-4 py-3 font-medium">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <HistoryRow key={item.id} item={item} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
