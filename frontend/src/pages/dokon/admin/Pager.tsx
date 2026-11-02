import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

/** The page numbers to show: the first, the last, and the current one with its neighbours; null = a gap. */
export function pageItems(page: number, pages: number): Array<number | null> {
  const keep = new Set([1, pages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pages));
  const sorted = [...keep].sort((a, b) => a - b);
  const out: Array<number | null> = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) out.push(null);
    out.push(n);
  });
  return out;
}

const cell = "flex h-9 min-w-9 items-center justify-center rounded-full px-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B84F5]/70";

/** "‹ 1 … 4 5 6 … 9 ›" — nothing when everything fits on one page. */
export function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (page: number) => void }) {
  const { t } = useTranslation();
  if (pages <= 1) return null;
  return (
    <nav aria-label={t("dokon.admin.products.pages")} className="flex flex-wrap items-center justify-center gap-1">
      <button type="button" aria-label={t("dokon.admin.products.prev_page")} disabled={page <= 1} onClick={() => onPage(page - 1)}
        className={cn(cell, "text-ink-muted hover:bg-ink/10 disabled:opacity-40 disabled:hover:bg-transparent")}>
        <ChevronLeft size={16} aria-hidden="true" />
      </button>
      {pageItems(page, pages).map((n, i) =>
        n === null ? (
          <span key={`gap-${i}`} className="px-1 text-ink-muted" aria-hidden="true">…</span>
        ) : (
          <button key={n} type="button" aria-current={n === page ? "page" : undefined} onClick={() => onPage(n)}
            className={cn(cell, n === page ? "bg-ink text-card" : "text-ink hover:bg-ink/10")}>
            {n}
          </button>
        ),
      )}
      <button type="button" aria-label={t("dokon.admin.products.next_page")} disabled={page >= pages} onClick={() => onPage(page + 1)}
        className={cn(cell, "text-ink-muted hover:bg-ink/10 disabled:opacity-40 disabled:hover:bg-transparent")}>
        <ChevronRight size={16} aria-hidden="true" />
      </button>
    </nav>
  );
}
