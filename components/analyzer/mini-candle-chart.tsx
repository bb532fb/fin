import { formatSymbolPair } from "@/lib/config/market";
import { formatPrice } from "@/lib/format";
import type { AnalysisResult } from "@/types/analysis";

type Candle = AnalysisResult["recentCandles"][number];

const WIDTH = 420;
const HEIGHT = 220;
const PAD = { top: 12, right: 64, bottom: 24, left: 8 };
const GRID_STEPS = 4;
const PLOT_W = WIDTH - PAD.left - PAD.right;
const PLOT_H = HEIGHT - PAD.top - PAD.bottom;

interface Scale {
  min: number;
  max: number;
  yOf: (price: number) => number;
}

function buildScale(candles: Candle[]): Scale {
  const min = Math.min(...candles.map((c) => c.l));
  const max = Math.max(...candles.map((c) => c.h));
  const span = Math.max(max - min, Number.EPSILON);
  return { min, max, yOf: (price) => PAD.top + ((max - price) / span) * PLOT_H };
}

function formatTime(t: number): string {
  return new Date(t).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

function ChartGrid({ scale, candles, precision }: { scale: Scale; candles: Candle[]; precision: number }) {
  const ticks = Array.from({ length: GRID_STEPS + 1 }, (_, i) => scale.max - ((scale.max - scale.min) * i) / GRID_STEPS);
  const timeIdx = [0, Math.floor(candles.length / 2), candles.length - 1];
  const slot = PLOT_W / candles.length;
  return (
    <g className="fill-subtle stroke-border text-[10px]">
      {ticks.map((price) => (
        <g key={price}>
          <line x1={PAD.left} x2={WIDTH - PAD.right} y1={scale.yOf(price)} y2={scale.yOf(price)} strokeDasharray="2 4" />
          <text x={WIDTH - PAD.right + 6} y={scale.yOf(price) + 3} stroke="none">
            {formatPrice(price, precision)}
          </text>
        </g>
      ))}
      {timeIdx.map((i) => {
        const candle = candles[i];
        if (!candle) return null;
        return (
          <text key={i} x={PAD.left + i * slot + slot / 2} y={HEIGHT - 6} textAnchor="middle" stroke="none">
            {formatTime(candle.t)}
          </text>
        );
      })}
    </g>
  );
}

function Candles({ scale, candles }: { scale: Scale; candles: Candle[] }) {
  const slot = PLOT_W / candles.length;
  const bodyW = Math.max(2, slot * 0.55);
  return candles.map((candle, index) => {
    const x = PAD.left + index * slot + slot / 2;
    const color = candle.c >= candle.o ? "fill-long stroke-long" : "fill-short stroke-short";
    const yOpen = scale.yOf(candle.o);
    const yClose = scale.yOf(candle.c);
    return (
      <g key={candle.t} className={color}>
        <line x1={x} x2={x} y1={scale.yOf(candle.h)} y2={scale.yOf(candle.l)} strokeWidth={1} />
        <rect
          x={x - bodyW / 2}
          y={Math.min(yOpen, yClose)}
          width={bodyW}
          height={Math.max(1.5, Math.abs(yClose - yOpen))}
          stroke="none"
          rx={0.5}
        />
      </g>
    );
  });
}

export function MiniCandleChart({ result }: { result: AnalysisResult }) {
  const candles = result.recentCandles;
  const scale = buildScale(candles);
  const priceY = scale.yOf(result.price);
  const labelPrecision = Math.min(result.pricePrecision, result.price >= 1000 ? 0 : 2);

  return (
    <div className="relative overflow-hidden rounded-xl border border-border/70 bg-bg/50 p-3">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-56 w-full"
        role="img"
        aria-label={`${formatSymbolPair(result.symbol)} ${result.timeframe} candlestick chart`}
      >
        <ChartGrid scale={scale} candles={candles} precision={labelPrecision} />
        <line
          x1={PAD.left}
          x2={WIDTH - PAD.right}
          y1={priceY}
          y2={priceY}
          className="stroke-long/60"
          strokeWidth={1}
          strokeDasharray="4 3"
        />
        <Candles scale={scale} candles={candles} />
        <foreignObject x={WIDTH - PAD.right + 2} y={priceY - 11} width={60} height={22}>
          <div className="rounded-md bg-long/90 px-1.5 py-0.5 text-center font-mono text-[10px] font-semibold text-bg">
            {formatPrice(result.price, labelPrecision)}
          </div>
        </foreignObject>
      </svg>
    </div>
  );
}
