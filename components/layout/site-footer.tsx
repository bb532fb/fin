import { DISCLAIMER, ENGINE_VERSION } from "@/lib/config/trading";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border/80 bg-surface/40">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-subtle">
          <span>Binance</span>
          <span aria-hidden>·</span>
          <span>Engine v{ENGINE_VERSION}</span>
          <span aria-hidden>·</span>
          <span>Crypto AI Analyst</span>
        </div>
        <p className="text-center text-xs leading-relaxed text-subtle">{DISCLAIMER}</p>
      </div>
    </footer>
  );
}
