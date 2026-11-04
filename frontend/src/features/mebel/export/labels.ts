import type { Part } from "@/features/mebel/engine";

export type LabelFormat = "a4" | "roll";

/** What one part's sticker shows. `edges`: band thickness per side, null where unbanded. */
export interface PartLabel {
  partId: string
  role: Part["role"]
  /** A free part's own name. */
  name?: string
  cabinet: string
  material: string
  length: number
  width: number
  thickness: number
  grain: Part["grain"]
  edges: Record<"L1" | "L2" | "W1" | "W2", number | null>
  /** The workshop page for this part (no account): its drilling map, on the worker's phone. */
  url: string
}

/**
 * Six base-36 characters that change whenever anything the worker cuts or drills
 * by changes: size, thickness, material, grain, edge bands, holes. The label
 * carries it, so the workshop page can say "this part changed since printing".
 * 32-bit FNV-1a: a short, stable checksum, not a security measure.
 * `materialKey` is the part's catalogue id, else its kind: the same on the
 * owner's computer and the worker's phone, whatever their language or catalogue.
 */
export function partFingerprint(part: Part, materialKey: string): string {
  const e = part.edges;
  const band = (s: Part["edges"]["L1"]) => s?.thickness || null;
  const key = JSON.stringify([
    part.finished.length, part.finished.width, part.thickness, materialKey, part.grain,
    [band(e.L1), band(e.L2), band(e.W1), band(e.W2)],
    (part.holes ?? []).map((h) => [h.kind, h.face, h.u, h.v, h.diameter, h.depth]),
  ]);
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36).padStart(6, "0").slice(-6);
}

/**
 * One label per part the workshop cuts, in id order. The engine lists every
 * part on its own (qty 1); MDF doors are never parts — the facade shop makes
 * them — so they get no label.
 */
export function partLabels(
  parts: Part[],
  opts: { token: string; origin: string; labelOf(cabinetId: string): string; materialName(p: Part): string },
): PartLabel[] {
  return [...parts]
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
    .map((p) => {
      const material = opts.materialName(p);
      return {
        partId: p.id,
        role: p.role,
        name: p.name,
        cabinet: opts.labelOf(p.cabinetId),
        material,
        length: p.finished.length,
        width: p.finished.width,
        thickness: p.thickness,
        grain: p.grain,
        edges: {
          L1: p.edges.L1?.thickness || null, L2: p.edges.L2?.thickness || null,
          W1: p.edges.W1?.thickness || null, W2: p.edges.W2?.thickness || null,
        },
        url: `${opts.origin}/d/${opts.token}?p=${encodeURIComponent(p.id)}&v=${partFingerprint(p, p.materialId ?? p.material)}`,
      };
    });
}
