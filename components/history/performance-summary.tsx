import { Card, CardTitle } from "@/components/ui/card";
import { Stat } from "@/components/ui/stat";
import { MIN_SIGNALS_FOR_STATS } from "@/lib/config/tracking";
import type { PerformanceStats } from "@/services/analysis-repository";

function verdict(stats: PerformanceStats, closed: number): { text: string; className: string } {
  if (closed < MIN_SIGNALS_FOR_STATS || stats.expectancyR === null) {
    return {
      text: `Դեռ վաղ է եզրակացություն անել. փակված է ${closed} signal, պետք է առնվազն ${MIN_SIGNALS_FOR_STATS}։ Այս ընթացքում իրական գումար մի դիր։`,
      className: "text-caution",
    };
  }
  if (stats.expectancyR <= 0) {
    return {
      text: "Signal-ները առայժմ շահույթ չեն բերում։ Իրական գումար մի դիր։",
      className: "text-short",
    };
  }
  return {
    text: "Signal-ները առայժմ դրական արդյունք են ցույց տալիս (առանց միջնորդավճարների)։ Սա երաշխիք չէ. սկսիր փոքր գումարով։",
    className: "text-long",
  };
}

export function PerformanceSummary({
  stats,
  marketLabel = "Spot",
}: {
  stats: PerformanceStats;
  marketLabel?: string;
}) {
  const closed = stats.wins + stats.losses;
  const { text, className } = verdict(stats, closed);
  const winRate = stats.winRate === null ? "—" : `${(stats.winRate * 100).toFixed(1)}%`;
  const expectancy =
    stats.expectancyR === null ? "—" : `${stats.expectancyR > 0 ? "+" : ""}${stats.expectancyR.toFixed(2)}R`;

  return (
    <Card className="flex flex-col gap-4 p-6">
      <CardTitle>
        {marketLabel} · signal-ների արդյունքները (engine v{stats.engineVersion})
      </CardTitle>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Հաղթերի %" value={winRate} hint={`${closed} փակված`} />
        <Stat label="Միջին արդյունք" value={expectancy} hint="մեկ գործարքի համար" />
        <Stat label="Հաղթ" value={stats.wins} valueClassName="text-long" />
        <Stat label="Պարտ" value={stats.losses} valueClassName="text-short" />
        <Stat
          label="Ժամկետանց"
          value={stats.expiredOpen + stats.expiredUnfilled}
          hint={`${stats.expiredUnfilled} չբացված`}
        />
        <Stat label="Ընթացքում" value={stats.pending} />
      </div>
      <p className={`text-sm font-medium ${className}`}>{text}</p>
      <p className="text-xs leading-relaxed text-subtle">
        1R = Stop Loss-ով կորցրած գումարը։ +0.30R նշանակում է, որ միջինում ամեն գործարք բերում է
        ռիսկի 30%-ը։ Հաշվարկը զգուշավոր է. եթե մեկ candle-ը կպել է և՛ SL-ին, և՛ TP-ին, համարվում է
        LOSS։
      </p>
    </Card>
  );
}
