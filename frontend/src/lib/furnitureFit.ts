import type { RoomGeometry } from '@/store/types'
import type { FurnitureRole } from '@/lib/furnitureRole'
import { blocksOpening, roomModel, type Rect } from '@/lib/aiDesignLayout'

/** Stand tall enough to darken a window, as the AI layout reads them (lib/placement TALL_ROLES). */
const TALL = new Set<FurnitureRole>(['wardrobe', 'shelf', 'tv_unit'])

export interface FitPiece { id: string; name: string; role: FurnitureRole | undefined; rect: Rect }
/** 'outside': it sticks out of the room, through a wall or an opening in it; 'door': it stands in a door's swing; 'window': a tall piece before a window. */
export interface FitWarning { id: string; name: string; kind: 'outside' | 'door' | 'window' }

/**
 * The pieces standing where they cannot (prod e2e 2026-11-18: a 4 m kitchen set stood 1 m through a 3.5 m
 * kitchen's wall and window with no word). A warning only, nothing is moved. A rug lies on the floor and
 * is walked over: only one that leaves the room is flagged.
 */
export function furnitureFitWarnings(pieces: readonly FitPiece[], geometry: RoomGeometry): FitWarning[] {
  const model = roomModel(geometry)
  const out: FitWarning[] = []
  for (const p of pieces) {
    // A piece is placed WALL_GAP off its wall; a centimetre of slack keeps one dragged flush from flagging.
    const slack: Rect = { ...p.rect, w: Math.max(0, p.rect.w - 0.02), d: Math.max(0, p.rect.d - 0.02) }
    if (!model.inside(slack)) out.push({ id: p.id, name: p.name, kind: 'outside' })
    else if (p.role === 'rug') continue
    else if (blocksOpening(slack, false, model, { doors: true, windows: false })) out.push({ id: p.id, name: p.name, kind: 'door' })
    else if (p.role && TALL.has(p.role) && blocksOpening(slack, true, model, { doors: false, windows: true })) out.push({ id: p.id, name: p.name, kind: 'window' })
  }
  return out
}
