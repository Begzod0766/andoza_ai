import type { Result } from "@/features/mebel/engine";

export interface ProjectSummaryNumbers {
  /** New boards the layout cuts. */
  sheets: number;
  /** Pieces taken from the offcut store. */
  offcuts: number;
  /** Edge banding to buy, waste included, to one decimal. */
  edgeMeters: number;
  /** Pieces to cut. */
  parts: number;
  /** null while the project has no price. */
  total: number | null;
  warnings: number;
}

/** The handful of numbers a workshop quotes from, for the editor's summary bar. */
export function summarize(result: Result): ProjectSummaryNumbers {
  const laid = result.nesting.flatMap((n) => n.sheets);
  const edge = result.edgeTotals.reduce((sum, e) => sum + e.metersWithWaste, 0);
  return {
    sheets: laid.filter((s) => !s.stockId).length,
    offcuts: laid.filter((s) => s.stockId).length,
    edgeMeters: Math.round(edge * 10) / 10,
    parts: result.groups.reduce((sum, g) => sum + g.qty, 0),
    total: result.total,
    warnings: result.warnings.length,
  };
}
