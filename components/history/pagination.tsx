import Link from "next/link";
import type { HistoryQuery } from "@/components/history/history-filters";

interface PaginationProps {
  page: number;
  totalPages: number;
  query: HistoryQuery;
}

const linkClass =
  "rounded-lg border border-border-strong px-3 py-1.5 text-sm font-medium text-text transition hover:border-accent";

function pageHref(page: number, query: HistoryQuery): string {
  const params = new URLSearchParams();
  if (page > 1) params.set("page", String(page));
  if (query.status) params.set("status", query.status);
  if (query.direction) params.set("direction", query.direction);
  if (query.minConfidence) params.set("minConfidence", query.minConfidence);
  if (query.market) params.set("market", query.market);
  const qs = params.toString();
  return qs ? `/history?${qs}` : "/history";
}

export function Pagination({ page, totalPages, query }: PaginationProps) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label="Պատմության էջեր" className="flex items-center justify-between gap-4 p-4">
      {page > 1 ? (
        <Link href={pageHref(page - 1, query)} className={linkClass}>
          Նախորդ
        </Link>
      ) : (
        <span />
      )}
      <span className="text-sm text-muted">
        Էջ {page} / {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={pageHref(page + 1, query)} className={linkClass}>
          Հաջորդ
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
