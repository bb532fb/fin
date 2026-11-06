import { useId } from "react";
import type { ReactNode } from "react";
import { ChevronRightIcon } from "@/components/ui/icons";

interface SelectFieldProps<T extends string> {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
  icon?: ReactNode;
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
  icon,
}: SelectFieldProps<T>) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-xs font-medium uppercase tracking-wider text-muted">
        {label}
      </label>
      <div className="relative flex items-center">
        {icon && <span className="pointer-events-none absolute left-3.5 flex">{icon}</span>}
        <select
          id={id}
          value={value}
          disabled={disabled}
          onChange={(event) => {
            const next = options.find((option) => option.value === event.target.value);
            if (next) onChange(next.value);
          }}
        className={`h-12 w-full appearance-none rounded-xl border border-border-strong bg-surface-raised/90 pr-10 text-sm font-semibold text-text outline-none transition focus:border-accent-glow focus:shadow-[0_0_0_3px_rgb(34_211_238_/_0.12)] disabled:opacity-60 ${icon ? "pl-11" : "pl-4"}`}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-3.5 rotate-90 text-muted">
          <ChevronRightIcon width={16} height={16} />
        </span>
      </div>
    </div>
  );
}
