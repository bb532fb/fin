import { Card } from "@/components/ui/card";
import { IconTile } from "@/components/ui/icon-tile";
import { CheckIcon, TrendDownIcon, TrendUpIcon } from "@/components/ui/icons";
import type { AnalysisResult } from "@/types/analysis";

type Condition = AnalysisResult["conditions"][number];

const SIDE_STYLE = {
  BULL: {
    title: "Աջակցող գործոններ",
    card: "border-long/30 bg-[linear-gradient(160deg,rgb(34_227_138_/_0.08),transparent_60%)]",
    text: "text-long",
    bg: "bg-long",
    tone: "long",
    icon: <TrendUpIcon />,
  },
  BEAR: {
    title: "Բացասական գործոններ",
    card: "border-short/30 bg-[linear-gradient(160deg,rgb(242_85_106_/_0.08),transparent_60%)]",
    text: "text-short",
    bg: "bg-short",
    tone: "short",
    icon: <TrendDownIcon />,
  },
} as const;

function ConditionRow({ condition, maxWeight }: { condition: Condition; maxWeight: number }) {
  const style = SIDE_STYLE[condition.side];
  return (
    <li className="flex items-center gap-2.5 text-sm">
      <span
        aria-hidden
        className={`grid size-5 shrink-0 place-items-center rounded-full ${
          condition.met ? `${style.bg} text-bg` : "bg-border-strong text-subtle"
        }`}
      >
        {condition.met ? <CheckIcon width={12} height={12} strokeWidth={3} /> : "–"}
      </span>
      <span className={condition.met ? "text-text" : "text-subtle"}>{condition.label}</span>
      <span className="sr-only">{condition.met ? "(կատարված)" : "(չկատարված)"}</span>
      <span aria-hidden className="ml-auto h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-bg/70">
        <span
          className={`block h-full rounded-full ${condition.met ? style.bg : "bg-border-strong"}`}
          style={{ width: `${(condition.weight / maxWeight) * 100}%` }}
        />
      </span>
    </li>
  );
}

function ConditionColumn({ side, items }: { side: Condition["side"]; items: Condition[] }) {
  const style = SIDE_STYLE[side];
  const maxWeight = Math.max(1, ...items.map((c) => c.weight));
  return (
    <Card className={`flex flex-col gap-4 p-5 sm:p-6 ${style.card}`}>
      <div className="flex items-center gap-3">
        <IconTile tone={style.tone} size="sm">
          {style.icon}
        </IconTile>
        <h3 className={`font-semibold ${style.text}`}>{style.title}</h3>
      </div>
      <ul className="flex flex-col gap-2.5">
        {items.map((condition) => (
          <ConditionRow key={condition.id} condition={condition} maxWeight={maxWeight} />
        ))}
      </ul>
    </Card>
  );
}

export function ConditionList({ conditions }: { conditions: Condition[] }) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <ConditionColumn side="BULL" items={conditions.filter((c) => c.side === "BULL")} />
      <ConditionColumn side="BEAR" items={conditions.filter((c) => c.side === "BEAR")} />
    </div>
  );
}
