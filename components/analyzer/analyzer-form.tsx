import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/ui/icon-tile";
import {
  ArrowRightIcon,
  BulbIcon,
  ChevronRightIcon,
  ClockIcon,
  CoinIcon,
} from "@/components/ui/icons";
import { SelectField } from "@/components/ui/select-field";
import {
  formatSymbolPair,
  symbolsFor,
  timeframeOptionLabel,
  timeframesFor,
} from "@/lib/config/market";
import type { MarketVenue, SupportedSymbol, Timeframe } from "@/lib/config/market";

interface AnalyzerFormProps {
  venue: MarketVenue;
  pocketOtc: boolean;
  symbol: SupportedSymbol;
  timeframe: Timeframe;
  loading: boolean;
  onSymbolChange: (symbol: SupportedSymbol) => void;
  onTimeframeChange: (timeframe: Timeframe) => void;
  onSubmit: () => void;
}

export function AnalyzerForm(props: AnalyzerFormProps) {
  const symbolOptions = symbolsFor(props.venue).map((value) => ({
    value,
    label: formatSymbolPair(value),
  }));
  const timeframeOptions = timeframesFor(props.venue).map((value) => ({
    value,
    label: timeframeOptionLabel(props.venue, value),
  }));
  const timed = props.venue === "futures" || props.venue === "pocket";
  const blocked = props.pocketOtc;

  return (
    <div className="flex flex-col gap-4">
      <form
        className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          props.onSubmit();
        }}
      >
        <SelectField
          label="Զույգ"
          value={props.symbol}
          options={symbolOptions}
          onChange={props.onSymbolChange}
          disabled={props.loading || blocked}
          icon={<CoinIcon className="text-caution" />}
        />
        <SelectField
          label={timed ? "Գրաֆիկ" : "Ժամանակաշրջան"}
          value={props.timeframe}
          options={timeframeOptions}
          onChange={props.onTimeframeChange}
          disabled={props.loading || blocked}
          icon={<ClockIcon className="text-muted" />}
        />
        <Button type="submit" loading={props.loading} disabled={blocked} className="sm:min-w-56">
          {props.loading ? "Վերլուծում եմ…" : "Վերլուծել շուկան"}
          {!props.loading && <ArrowRightIcon width={16} height={16} />}
        </Button>
      </form>
      <div className="flex items-center gap-3 rounded-xl border border-border/80 bg-surface-raised/40 px-4 py-3 text-sm text-muted">
        <IconTile tone="accent" size="sm">
          <BulbIcon width={16} height={16} />
        </IconTile>
        <p className="flex-1">
          <span className="block font-semibold text-text">Ուշադրություն</span>
          {blocked ? (
            <>
              OTC-ն միացված է։ Pocket Option-ի OTC գինը հանրային չէ, այդ պատճառով վերլուծել չի լինում։
              Ընտրիր «Ոչ OTC»։
            </>
          ) : props.venue === "pocket" ? (
            <>
              Ոչ OTC։ Դնում ես UP կամ DOWN{" "}
              <span className="font-semibold text-text">{timeframeOptionLabel("pocket", props.timeframe)}</span>ով։
              Գինը իրական շուկայինն է։
            </>
          ) : props.venue === "futures" ? (
            <>
              Ընտրված գրաֆիկի րոպեն այն ժամանակն է, որով պատասխանը կասի դնել։ Հիմա՝{" "}
              <span className="font-semibold text-text">{timeframeOptionLabel("futures", props.timeframe)}</span>։
            </>
          ) : (
            <>
              Վերլուծությունը հիմնված է ընտրված{" "}
              <span className="font-semibold text-text">{props.timeframe}</span> ժամանակաշրջանի վրա։
              Ավելի մեծ ժամանակաշրջաններն ավելի կայուն ազդանշաններ են տալիս։
            </>
          )}
        </p>
        <ChevronRightIcon className="shrink-0 text-subtle" />
      </div>
    </div>
  );
}
