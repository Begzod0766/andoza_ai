import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatUZS } from "@/lib/utils";
import type { ProjectSummaryNumbers } from "./summary";

export type SummaryTab = "nesting" | "edges" | "parts" | "bom" | "warnings";

const segment = "whitespace-nowrap rounded-full px-2.5 py-1 text-sm font-semibold text-ink hover:bg-ink/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B84F5]/70";

/**
 * Under the editor's header: sheets, edge banding, parts, price and warnings, always in view;
 * each opens the tab that explains it.
 */
export function SummaryBar({ summary: s, priceReady, onOpen }: {
  summary: ProjectSummaryNumbers;
  priceReady: boolean;
  onOpen: (tab: SummaryTab) => void;
}) {
  const { t } = useTranslation();
  const sheets = s.offcuts > 0
    ? `${t("mebel.summary.sheets", { n: s.sheets })} + ${t("mebel.summary.offcuts", { n: s.offcuts })}`
    : t("mebel.summary.sheets", { n: s.sheets });
  const price = priceReady && s.total != null ? formatUZS(s.total) : "—";
  const dot = <span className="text-ink-muted" aria-hidden="true">·</span>;

  return (
    <div role="group" aria-label={t("mebel.summary.label")}
      className="flex flex-wrap items-center gap-x-1 gap-y-1 border-b border-line bg-card px-3 py-1.5 print:hidden">
      <button type="button" className={segment} onClick={() => onOpen("nesting")}>{sheets}</button>
      {dot}
      <button type="button" className={segment} onClick={() => onOpen("edges")}>
        {t("mebel.summary.edge", { m: s.edgeMeters.toLocaleString(undefined, { maximumFractionDigits: 1 }) })}
      </button>
      {dot}
      <button type="button" className={segment} onClick={() => onOpen("parts")}>{t("mebel.summary.parts", { n: s.parts })}</button>
      {dot}
      <button type="button" className={segment} aria-label={`${t("mebel.summary.price_label")}: ${price}`} onClick={() => onOpen("bom")}>{price}</button>
      {s.warnings > 0 && (
        <>
          {dot}
          <button type="button" onClick={() => onOpen("warnings")} aria-label={t("mebel.summary.warnings", { n: s.warnings })}
            className={`${segment} inline-flex items-center gap-1 text-amber-500`}>
            <AlertTriangle size={14} aria-hidden="true" />{s.warnings}
          </button>
        </>
      )}
    </div>
  );
}
