import i18n from "@/i18n";
import { turnedSize, type ModelYaw } from "@/lib/modelYaw";

/** A model's real size in centimetres, as the studio will draw it. */
export interface MeasuredSize {
  width_cm: number;
  depth_cm: number;
  height_cm: number;
}

/** The largest size the catalog stores (its columns hold up to 999.99 cm). */
const MAX_CM = 999;

/** What the server stores of a measured model; nothing when it could not be measured or is out of range. */
export function sizeFields(size: MeasuredSize | null): { footprint_w?: number; footprint_d?: number; height_cm?: number } {
  if (!size) return {};
  const ok = [size.width_cm, size.depth_cm, size.height_cm].every((v) => Number.isFinite(v) && v > 0 && v <= MAX_CM);
  return ok ? { footprint_w: size.width_cm, footprint_d: size.depth_cm, height_cm: size.height_cm } : {};
}

/** The size of a model once turned by its yaw: a quarter turn swaps width and depth. */
export function turnedMeasuredSize(size: MeasuredSize | null, yaw: ModelYaw): MeasuredSize | null {
  if (!size) return null;
  const { w, d } = turnedSize({ w: size.width_cm, d: size.depth_cm }, yaw);
  return { ...size, width_cm: w, depth_cm: d };
}

/** "210 × 90 × 85 sm": width, depth and height, as a person reads them. */
export function describeSize(size: MeasuredSize): string {
  const n = (v: number) => String(Math.round(v));
  return `${n(size.width_cm)} × ${n(size.depth_cm)} × ${n(size.height_cm)} ${i18n.t("dokon.model.cm")}`;
}

/** How far under the ceiling a model shrunk to fit stops, mm: touching it would flicker against it. */
export const CEILING_GAP_MM = 20;

/**
 * The scale a model is drawn at, brought down so it stands under the ceiling. A TV wall unit
 * 2.7 m tall went through a 2.4 m ceiling when a style placed it (QA 2026-11-05 #3); the catalog
 * often has no height for a model, so this is decided where the model is drawn, from its own box.
 * `scale` turns the model's units into metres; `rawHeight` is its height in those units.
 * Unchanged when it fits, or when the ceiling or the height is not known.
 */
export function ceilingFitScale(scale: number, rawHeight: number, ceilingMm: number): number {
  if (!(ceilingMm > CEILING_GAP_MM) || !(rawHeight > 0) || !(scale > 0)) return scale;
  const room = (ceilingMm - CEILING_GAP_MM) / 1000;
  return rawHeight * scale > room ? room / rawHeight : scale;
}
