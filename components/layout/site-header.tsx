"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/layout/theme-toggle";

const NAV_ITEMS = [
  { href: "/", label: "Վերլուծություն" },
  { href: "/history", label: "Պատմություն" },
  { href: "/about", label: "Մասին" },
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-10 overflow-x-clip border-b border-border/80 bg-bg/70 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl min-w-0 items-center gap-2 px-3 sm:h-16 sm:gap-3 sm:px-6">
        <Link
          href="/"
          className="flex min-w-0 shrink items-center gap-2 font-semibold tracking-tight sm:gap-2.5"
        >
          <span
            aria-hidden
            className="grid size-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-accent via-violet to-accent-glow text-xs font-bold text-white shadow-[0_0_18px_rgb(61_139_253_/_0.45)]"
          >
            AI
          </span>
          <span className="hidden truncate text-sm min-[400px]:inline sm:text-base">
            Crypto AI Analyst
          </span>
        </Link>
        <nav
          aria-label="Հիմնական նավիգացիա"
          className="ml-auto flex min-w-0 shrink-0 items-center gap-0.5 sm:gap-1"
        >
          {NAV_ITEMS.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`relative rounded-lg px-1.5 py-2 text-xs font-medium transition sm:px-3 sm:text-sm ${
                  active ? "text-text" : "text-muted hover:text-text"
                }`}
              >
                {item.label}
                {active && (
                  <span
                    aria-hidden
                    className="absolute inset-x-1.5 -bottom-0.5 h-0.5 rounded-full bg-gradient-to-r from-accent to-accent-glow sm:inset-x-3"
                  />
                )}
              </Link>
            );
          })}
        </nav>
        <div className="shrink-0">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
