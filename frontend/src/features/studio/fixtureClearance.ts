import { useMemo } from 'react'
import { useRoomStore } from '@/store/roomStore'
import { fixtureClearances, type ClearanceWarning } from '@/lib/fixtureClearance'
import { placedFurnitureBoxes } from '@/features/studio/nextFurnitureSpot'
import { boilerSpot, hatchBlockers, railSpans, wetSpans } from '@/lib/bathroomBoxes'
import { roomRiser } from '@/lib/plumbingRuns'

type State = ReturnType<typeof useRoomStore.getState>

/** The fixtures short of free floor in front (2026-11-18), from the room as drawn. A warning only. */
function pieces(s: State) {
  return placedFurnitureBoxes(s).map((p, i) => ({
    id: p.id ?? String(i),
    name: p.name ?? '',
    role: p.role,
    rect: { x: p.x / 1000, z: p.y / 1000, w: p.w, d: p.d, rotation: p.rotation },
  }))
}

export function roomClearances(s: State): ClearanceWarning[] {
  return fixtureClearances(pieces(s), s.geometry)
}

/** The pieces in front of the riser box's revision hatch (2026-11-18), by name. */
export function roomHatchBlockers(s: State): string[] {
  return hatchBlockers(s.geometry, roomRiser(s.geometry, s.plumbingRiser), pieces(s))
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

/** The same for the hatch, kept up to date with the room. */
export function useHatchBlockers(): string[] {
  const furniture = useRoomStore((s) => s.furniture)
  const geometry = useRoomStore((s) => s.geometry)
  const catalog = useRoomStore((s) => s.catalogFurniture)
  const user = useRoomStore((s) => s.userFurniture)
  const riser = useRoomStore((s) => s.plumbingRiser)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => roomHatchBlockers(useRoomStore.getState()), [furniture, geometry, catalog, user, riser])
}

/** Where the water heater hangs (2026-11-18): by the riser if it can, else the nearest free wall; null when
 * no wall takes it. The 3D draws it here and the panel warns when it is null. */
export function roomBoilerSpot(s: State) {
  const blocked = [...wetSpans(s.furniture, s.catalogFurniture, s.geometry), ...railSpans(s.towelRails)]
  return boilerSpot(s.geometry, roomRiser(s.geometry, s.plumbingRiser), s.ceilingHeight, blocked)
}

/** Whether the water heater is in the estimate but no wall takes it, kept up to date with the room. */
export function useBoilerHomeless(): boolean {
  const on = useRoomStore((s) => s.designState.waterHeater === true)
  const furniture = useRoomStore((s) => s.furniture)
  const geometry = useRoomStore((s) => s.geometry)
  const catalog = useRoomStore((s) => s.catalogFurniture)
  const rails = useRoomStore((s) => s.towelRails)
  const riser = useRoomStore((s) => s.plumbingRiser)
  const ceiling = useRoomStore((s) => s.ceilingHeight)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => on && roomBoilerSpot(useRoomStore.getState()) === null, [on, furniture, geometry, catalog, rails, riser, ceiling])
}
