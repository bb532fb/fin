import type { ButtonHTMLAttributes } from "react";
import { Spinner } from "@/components/ui/spinner";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
}

export function Button({ loading = false, disabled, children, className = "", ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading}
      className={`inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent-glow via-accent to-violet px-6 text-sm font-semibold text-white shadow-[0_0_28px_rgb(34_211_238_/_0.35)] transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none ${className}`}
    >
      {loading ? (
        <Spinner />
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M15 4V2M15 16v-2M8 9H6m12 0h-2M5.5 5.5l1.4 1.4m8.2 8.2 1.4 1.4m0-11-1.4 1.4M6.9 15.1 5.5 16.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M9.5 14.5 14 4l2.5 2.5-9.5 5.5Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
      )}
      {children}
    </button>
  );
}
