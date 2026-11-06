import type { ReactNode } from "react";
import Link from "next/link";

export interface HistoryQuery {
  status?: string;
  direction?: string;
  minConfidence?: string;
  market?: string;
}

function hrefFor(next: HistoryQuery): string {
  const params = new URLSearchParams();
  if (next.status) params.set("status", next.status);
  if (next.direction) params.set("direction", next.direction);
  if (next.minConfidence) params.set("minConfidence", next.minConfidence);
  if (next.market) params.set("market", next.market);
  const query = params.toString();
  return query ? `/history?${query}` : "/history";
}

function Chip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
        active
          ? "bg-accent/15 text-accent"
          : "border border-border-strong text-muted hover:border-accent hover:text-text"
      }`}
    >
      {children}
    </Link>
  );
}

export function HistoryFilters({ query }: { query: HistoryQuery }) {
  const status = query.status ?? "";
  const direction = query.direction ?? "";
  const minConfidence = query.minConfidence ?? "";
  const market = query.market ?? "";

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface-raised/40 p-4">
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Շուկա</p>
        <div className="flex flex-wrap gap-2">
          <Chip href={hrefFor({ ...query, market: undefined })} active={!market}>
            Բոլորը
          </Chip>
          <Chip href={hrefFor({ ...query, market: "spot" })} active={market === "spot"}>
            Spot
          </Chip>
          <Chip href={hrefFor({ ...query, market: "futures" })} active={market === "futures"}>
            Futures
          </Chip>
          <Chip href={hrefFor({ ...query, market: "pocket" })} active={market === "pocket"}>
            Pocket Option
          </Chip>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Կարգավիճակ</p>
        <div className="flex flex-wrap gap-2">
          <Chip href={hrefFor({ ...query, status: undefined })} active={!status}>
            Բոլորը
          </Chip>
          <Chip href={hrefFor({ ...query, status: "TRADES" })} active={status === "TRADES"}>
            Միայն գործարքներ
          </Chip>
          <Chip href={hrefFor({ ...query, status: "WIN" })} active={status === "WIN"}>
            Հաղթ
          </Chip>
          <Chip href={hrefFor({ ...query, status: "LOSS" })} active={status === "LOSS"}>
            Պարտ
          </Chip>
          <Chip href={hrefFor({ ...query, status: "PENDING" })} active={status === "PENDING"}>
            Ընթացքում
          </Chip>
          <Chip href={hrefFor({ ...query, status: "EXPIRED" })} active={status === "EXPIRED"}>
            Ժամկետանց
          </Chip>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Ուղղություն</p>
        <div className="flex flex-wrap gap-2">
          <Chip href={hrefFor({ ...query, direction: undefined })} active={!direction}>
            Բոլորը
          </Chip>
          <Chip href={hrefFor({ ...query, direction: "LONG" })} active={direction === "LONG"}>
            Վերև (UP)
          </Chip>
          <Chip href={hrefFor({ ...query, direction: "SHORT" })} active={direction === "SHORT"}>
            Ներքև (DOWN)
          </Chip>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Ուժ</p>
        <div className="flex flex-wrap gap-2">
          <Chip href={hrefFor({ ...query, minConfidence: undefined })} active={!minConfidence}>
            Բոլորը
          </Chip>
          <Chip
            href={hrefFor({ ...query, minConfidence: "65" })}
            active={minConfidence === "65"}
          >
            ≥ 65
          </Chip>
          <Chip
            href={hrefFor({ ...query, minConfidence: "70" })}
            active={minConfidence === "70"}
          >
            ≥ 70
          </Chip>
          <Chip
            href={hrefFor({ ...query, minConfidence: "75" })}
            active={minConfidence === "75"}
          >
            ≥ 75
          </Chip>
        </div>
      </div>
    </div>
  );
}
