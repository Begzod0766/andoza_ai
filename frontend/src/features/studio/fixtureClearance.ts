import { useMemo } from 'react'
import { useRoomStore } from '@/store/roomStore'
import { fixtureClearances, type ClearanceWarning } from '@/lib/fixtureClearance'
import { placedFurnitureBoxes } from '@/features/studio/nextFurnitureSpot'

type State = ReturnType<typeof useRoomStore.getState>

/** The fixtures short of free floor in front (2026-11-18), from the room as drawn. A warning only. */
export function roomClearances(s: State): ClearanceWarning[] {
  const pieces = placedFurnitureBoxes(s).map((p, i) => ({
    id: p.id ?? String(i),
    name: p.name ?? '',
    role: p.role,
    rect: { x: p.x / 1000, z: p.y / 1000, w: p.w, d: p.d, rotation: p.rotation },
  }))
  return fixtureClearances(pieces, s.geometry)
}

/** The same, kept up to date with the room. */
export function useFixtureClearances(): ClearanceWarning[] {
  const furniture = useRoomStore((s) => s.furniture)
  const geometry = useRoomStore((s) => s.geometry)
  const catalog = useRoomStore((s) => s.catalogFurniture)
  const user = useRoomStore((s) => s.userFurniture)
  const ceiling = useRoomStore((s) => s.ceilingHeight)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => roomClearances(useRoomStore.getState()), [furniture, geometry, catalog, user, ceiling])
}
