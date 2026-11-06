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
    <header className="sticky top-0 z-10 border-b border-border/80 bg-bg/70 backdrop-blur-xl">
      <div className="mx-auto grid h-16 max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 justify-self-start font-semibold tracking-tight">
          <span
            aria-hidden
            className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-accent via-violet to-accent-glow text-xs font-bold text-white shadow-[0_0_18px_rgb(61_139_253_/_0.45)]"
          >
            AI
          </span>
          <span className="text-sm sm:text-base">Crypto AI Analyst</span>
        </Link>
        <nav aria-label="Հիմնական նավիգացիա" className="flex items-center gap-0.5 sm:gap-1">
          {NAV_ITEMS.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`relative rounded-lg px-2.5 py-2 text-sm font-medium transition sm:px-3 ${
                  active ? "text-text" : "text-muted hover:text-text"
                }`}
              >
                {item.label}
                {active && (
                  <span
                    aria-hidden
                    className="absolute inset-x-2.5 -bottom-0.5 h-0.5 rounded-full bg-gradient-to-r from-accent to-accent-glow sm:inset-x-3"
                  />
                )}
              </Link>
            );
          })}
        </nav>
        <div className="justify-self-end">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
