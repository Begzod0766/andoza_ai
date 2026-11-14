import type { RoomGeometry, TowelRail, Washer } from '@/store/types'
import { overlaps, type Rect } from '@/lib/aiDesignLayout'
import { wallWalk } from '@/lib/plumbingRuns'
import { railSize } from '@/lib/towelRail'
import { washerBox, WASHER_H_MM } from '@/lib/washer'

/**
 * Does a washing machine or a towel rail touch a piece of furniture? (spec 2026-11-15) Each is a
 * solid: a floor footprint and a height range, world metres. Only a warning is made of it.
 */
export interface Solid { rect: Rect; y0: number; y1: number }
export interface FurnitureSolid extends Solid { id: string; name: string }

/** A rail reaches this far into the room from its wall face, metres. */
const RAIL_DEPTH_M = 0.06

export function washerSolid(geometry: RoomGeometry, m: Washer): Solid | null {
  const rect = washerBox(geometry, m)
  return rect && { rect, y0: 0, y1: WASHER_H_MM / 1000 }
}

export function railSolid(geometry: RoomGeometry, rail: TowelRail): Solid | null {
  const w = wallWalk(geometry).find((x) => x.id === rail.wallId)
  if (!w) return null
  const { w: width, h } = railSize(rail)
  const t = rail.positionMm / 1000
  const out = RAIL_DEPTH_M / 2
  return {
    rect: { x: w.startX + w.dirX * t + w.nx * out, z: w.startZ + w.dirZ * t + w.nz * out, w: width / 1000, d: RAIL_DEPTH_M, rotation: Math.atan2(w.nx, w.nz) },
    y0: rail.heightMm / 1000,
    y1: (rail.heightMm + h) / 1000,
  }
}

/** The pieces `item` touches: footprints overlapping and height ranges overlapping (open at both ends). */
export function clashingPieces(item: Solid, pieces: readonly FurnitureSolid[]): FurnitureSolid[] {
  return pieces.filter((p) => p.y0 < item.y1 && item.y0 < p.y1 && overlaps(item.rect, p.rect, 0))
}

/** A touching machine or rail, drawn in the Santexnika stage. */
export const CLASH_COLOR = '#F87171'

/** `base`, or the warning red for an item that touches furniture while the Santexnika stage is on. */
export function clashColor(base: string, plumbingStage: boolean, clashing: boolean): string {
  return plumbingStage && clashing ? CLASH_COLOR : base
}
