import type { NestResult, StockPiece } from './model'

/** The stock pieces a layout cuts from: they leave the store when the job is cut. */
export function usedStockIds(nesting: NestResult[]): string[] {
  return nesting.flatMap((n) => n.sheets.flatMap((s) => (s.stockId ? [s.stockId] : [])))
}

/** What a layout leaves (each bin's offcuts, already at least 200 × 200): they enter the store when the job is cut. */
export function producedOffcuts(nesting: NestResult[]): Omit<StockPiece, 'id'>[] {
  // cut sizes carry 0.4 mm bands, so free rectangles can be fractional: keep the whole millimetres
  return nesting.flatMap((n) => n.sheets.flatMap((s) => s.offcuts
    .map((r) => ({ material: n.material, materialId: n.materialId, thickness: n.thickness, length: Math.floor(r.length), width: Math.floor(r.width) }))
    .filter((o) => o.length >= 200 && o.width >= 200)))
}
