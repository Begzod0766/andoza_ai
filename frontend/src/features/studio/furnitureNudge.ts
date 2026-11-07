import i18n from '@/i18n'
import { useRoomStore, type RoomGeometry } from '@/store/roomStore'
import { FURNITURE_CATALOG } from '@/lib/furnitureCatalog'
import { resolveCatalogEntry } from '@/lib/furnitureEntry'
import { ceilingFitSize } from '@/lib/modelSize'
import { planPolygon, offsetPolygon } from '@/lib/planPolygon'
import { roomExtents } from '@/lib/roomDims'
import { FUR_WALL_GAP, halfExtentsToBounds, planToWorld, worldToPlan, type RoomBounds } from '@/lib/furnitureBounds'
import { resolveFurnitureRotation, type Obstacle } from '@/lib/furnitureCollision'
import { showToast } from '@/components/ui/Toast'

/**
 * The toolbar's one-tap transforms for the selected piece: a quarter turn and a size step (QA
 * 2026-11-05 #14). Until these, a piece could be turned or resized only by dragging a handle, 5
 * degrees at a time, which is slow and fiddly on a phone.
 *
 * They act on the store directly, from outside the canvas, so the collision rule the rotate drag
 * applies is applied here too: a quarter turn shifts the piece off a wall or a neighbour by as
 * little as will do, and when nothing will, it does not turn and the user is told.
 */

/**
 * Each piece's footprint as the studio last measured it from its model (half width, half depth,
 * metres, scale included). The studio's furniture layer writes it; a piece it has not drawn yet
 * falls back to its catalog size.
 */
export const measuredFootprints = new Map<string, { hw: number; hd: number }>()

/** A model of unknown size is taken as this, metres. */
const UNKNOWN = { w: 0.6, d: 0.6 }
/** The scale one size step multiplies or divides by, and the range the scale drag keeps to. */
const SIZE_STEP = 1.1
const MIN_SCALE = 0.05
const MAX_SCALE = 20

/**
 * The walls a piece has to keep inside, in the plan's millimetres: the room's outline when it has
 * one (a drawn or scanned room), else the plain rectangle. The drag uses exactly this.
 */
export function furnitureRoomBounds(geometry: RoomGeometry, fallback?: { W: number; D: number }): RoomBounds {
  const poly = planPolygon(geometry)
  // For a polygon the extents must come from the same call planPolygon makes, or the plan frame
  // would be offset from the one the outline is expressed in.
  const ext = poly || !fallback ? roomExtents(geometry) : fallback
  return {
    W: ext.W * 1000,
    D: ext.D * 1000,
    inner: poly ? offsetPolygon(poly, -FUR_WALL_GAP) : null,
    outline: poly ? poly.vertices : null,
  }
}

/** A placed piece's half-extents, metres: as measured when drawn, else from its catalog size. */
function halfSize(id: string): { hw: number; hd: number } {
  const measured = measuredFootprints.get(id)
  if (measured) return measured
  const s = useRoomStore.getState()
  const f = s.furniture.find((x) => x.id === id)
  if (!f) return { hw: UNKNOWN.w / 2, hd: UNKNOWN.d / 2 }
  const row = s.catalogFurniture.find((c) => c.id === f.furniture_id)
  const size = s.userFurniture.find((e) => e.id === f.furniture_id)?.sizeM
    ?? resolveCatalogEntry(row)?.sizeM
    ?? FURNITURE_CATALOG.find((e) => e.id === f.furniture_id)?.sizeM
  const fitted = size && size.w > 0 && size.d > 0
    ? ceilingFitSize(size, row?.height_cm ? row.height_cm / 100 : undefined, s.ceilingHeight)
    : UNKNOWN
  const k = f.scaleOverride ?? 1
  return { hw: (fitted.w * k) / 2, hd: (fitted.d * k) / 2 }
}

/**
 * Turns the piece a quarter turn (`dir` 1 one way, -1 the other), clear of the walls and the other
 * pieces. Returns whether it turned.
 */
export function turnFurnitureQuarter(id: string, dir: 1 | -1 = 1): boolean {
  const s = useRoomStore.getState()
  const item = s.furniture.find((f) => f.id === id)
  if (!item) return false
  const bounds = furnitureRoomBounds(s.geometry)
  const own = halfSize(id)
  const others: Obstacle[] = s.furniture.filter((f) => f.id !== id).map((f) => {
    const h = halfSize(f.id)
    return {
      at: worldToPlan({ x: f.x / 1000, z: f.y / 1000 }, bounds),
      box: { ...halfExtentsToBounds(h.hw * 1000, h.hd * 1000), rotation: f.rotation },
    }
  })
  const want = item.rotation + dir * (Math.PI / 2)
  const solved = resolveFurnitureRotation(
    worldToPlan({ x: item.x / 1000, z: item.y / 1000 }, bounds),
    { ...halfExtentsToBounds(own.hw * 1000, own.hd * 1000), rotation: want },
    want,
    bounds,
    others,
  )
  if (!solved) {
    showToast({ variant: 'warning', title: i18n.t('studio.furn.no_turn') })
    return false
  }
  const at = planToWorld(solved.at, bounds)
  s.moveFurniture(id, at.x * 1000, at.z * 1000, solved.rotation)
  return true
}

/** One size step up (`dir` 1) or down (-1), within the range the scale drag allows. */
export function stepFurnitureSize(id: string, dir: 1 | -1): void {
  const s = useRoomStore.getState()
  const item = s.furniture.find((f) => f.id === id)
  if (!item) return
  const next = (item.scaleOverride ?? 1) * SIZE_STEP ** dir
  s.resizeFurniture(id, Math.max(MIN_SCALE, Math.min(MAX_SCALE, next)))
}
