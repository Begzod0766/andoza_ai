import { cutSize } from '../edges'
import type { Band, ConstructionDefaults, EdgeSide, FreePartSpec, Part } from '../model'

/**
 * One part per piece of a free part (ids D1-1, D1-2…), cut like any cabinet
 * part: bands taken off the cut size unless premilled. No holes, and no place
 * in the room: the 3D view draws cabinets only.
 */
export function freePartParts(spec: FreePartSpec, d: ConstructionDefaults): Part[] {
  const side = (b: Band): EdgeSide => {
    const t = b == null ? 0 : d.edge[b].thickness
    return b != null && t > 0 ? { band: b, thickness: t } : null
  }
  const edges = { L1: side(spec.edges.L1), L2: side(spec.edges.L2), W1: side(spec.edges.W1), W2: side(spec.edges.W2) }
  const from = spec.material === 'back'
    ? { materialId: d.back.materialId ?? null, thickness: d.back.thickness }
    : spec.material === 'facade'
      ? { materialId: d.facade.materialId, thickness: d.facade.thickness }
      : { materialId: d.board.materialId, thickness: d.board.thickness }
  const finished = { length: spec.length, width: spec.width }
  const cut = cutSize(finished, edges, d.edge.premilled)
  return Array.from({ length: Math.max(0, Math.floor(spec.qty)) }, (_, i) => ({
    id: `${spec.label}-${i + 1}`,
    cabinetId: spec.id,
    role: 'free' as const,
    name: spec.name,
    material: spec.material,
    ...from,
    finished: { ...finished },
    cut,
    grain: spec.grain,
    edges,
    qty: 1,
    placement: { x: 0, y: 0, z: 0, sx: 0, sy: 0, sz: 0 },
  }))
}
