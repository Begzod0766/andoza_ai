import { useMemo } from 'react'
import { useRoomStore } from '@/store/roomStore'
import { clashingPieces, railSolid, washerSolid, type FurnitureSolid, type Solid } from '@/lib/wallItemClash'
import { placedFurnitureBoxes } from '@/features/studio/nextFurnitureSpot'

type State = ReturnType<typeof useRoomStore.getState>

/** The room's furniture as solids, as drawn (a rug lies under the rest and is left out). */
export function furnitureSolids(s: State): FurnitureSolid[] {
  return placedFurnitureBoxes(s)
    .filter((p) => p.role !== 'rug')
    .map((p, i) => ({
      id: p.id ?? String(i),
      name: p.name ?? '',
      rect: { x: p.x / 1000, z: p.y / 1000, w: p.w, d: p.d, rotation: p.rotation },
      y0: 0,
      y1: p.h ?? 0.8,
    }))
}

/**
 * {washer or rail id: the names of the pieces it touches} (spec 2026-11-15), only for those that
 * touch something. A warning only: nothing is moved.
 */
export function wallItemClashes(s: State): Record<string, string[]> {
  const pieces = furnitureSolids(s)
  if (!pieces.length) return {}
  const out: Record<string, string[]> = {}
  const check = (id: string, solid: Solid | null) => {
    const hit = solid ? clashingPieces(solid, pieces) : []
    if (hit.length) out[id] = hit.map((p) => p.name)
  }
  for (const m of s.washers) check(m.id, washerSolid(s.geometry, m))
  for (const r of s.towelRails) check(r.id, railSolid(s.geometry, r))
  return out
}

/** The same, kept up to date with the room. */
export function useWallItemClashes(): Record<string, string[]> {
  const furniture = useRoomStore((s) => s.furniture)
  const washers = useRoomStore((s) => s.washers)
  const rails = useRoomStore((s) => s.towelRails)
  const geometry = useRoomStore((s) => s.geometry)
  const catalog = useRoomStore((s) => s.catalogFurniture)
  const user = useRoomStore((s) => s.userFurniture)
  const ceiling = useRoomStore((s) => s.ceilingHeight)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => wallItemClashes(useRoomStore.getState()), [furniture, washers, rails, geometry, catalog, user, ceiling])
}
