import type { ReactNode } from "react";

interface StatProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  valueClassName?: string;
  className?: string;
}

export function Stat({
  label,
  value,
  hint,
  icon,
  valueClassName = "text-text",
  className = "",
}: StatProps) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border border-border/80 bg-surface-raised/50 p-4 transition hover:border-border-strong ${className}`}
    >
      {icon}
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wider text-muted">{label}</span>
        <span className={`font-mono text-lg font-bold tabular-nums ${valueClassName}`}>{value}</span>
        {hint && <span className="text-xs text-subtle">{hint}</span>}
      </div>
    </div>
  );
}
