import { AnalyzerPanel } from "@/components/analyzer/analyzer-panel";

function HeroBackdrop() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 400 160"
      preserveAspectRatio="none"
      className="pointer-events-none absolute -top-6 right-0 -z-10 h-40 w-2/3 opacity-70"
    >
      <defs>
        <linearGradient id="hero-line" x1="0" x2="1">
          <stop offset="0" stopOpacity="0" style={{ stopColor: "var(--color-accent-glow)" }} />
          <stop offset="0.6" stopOpacity="0.7" style={{ stopColor: "var(--color-accent)" }} />
          <stop offset="1" style={{ stopColor: "var(--color-violet)" }} />
        </linearGradient>
      </defs>
      <path
        d="M0 140 L40 128 L80 134 L120 110 L160 118 L200 92 L240 98 L280 70 L320 78 L360 40 L400 20"
        fill="none"
        stroke="url(#hero-line)"
        strokeWidth="2"
      />
    </svg>
  );
}

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="relative isolate flex flex-col gap-4 overflow-x-clip pt-4 text-center animate-fade-up">
        <HeroBackdrop />
        <h1 className="hero-title bg-gradient-to-r from-text via-text to-accent-glow bg-clip-text text-3xl font-black tracking-tight text-transparent sm:text-5xl">
          Շուկայի վերլուծություն
        </h1>
        <p className="mx-auto max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
          Spot, Futures կամ Pocket Option։ Pocket Option-ում ընտրում ես ոչ OTC կամ OTC, րոպեական
          գրաֆիկը, և վերլուծությունը ասում է UP կամ DOWN ու քանի րոպեով դնել։
        </p>
      </div>
      <AnalyzerPanel />
    </div>
  );
}
