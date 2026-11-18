import type { DesignState, WallCovering } from '@/store/types'
import type { PhaseKey } from '@/lib/phases'
import { inferRole, ROLE_GROUP } from '@/lib/furnitureRole'

/**
 * The room as it is at a renovation stage (spec 2026-11-18, "0 dan 100% gacha"). The 3D draws the
 * stage the user picked in the stage list: everything from that stage and the ones before it, nothing
 * from the ones after. 'full' is the finished room, which the studio opens at and every render uses.
 * Nothing here changes the room: it only says what is drawn and how a surface looks.
 */
export type ViewStage = PhaseKey | 'full'

/** The stage a thing belongs to; 'always' for what is there from the start (shell, openings, points). */
export type ItemStage = PhaseKey | 'always'

/** A stage this room does not have stands in for the one it falls back to (no Jihozlar outside a bathroom or kitchen). */
const FALLBACK: Partial<Record<PhaseKey, ItemStage>> = { jihozlar: 'mebel', quvurlar: 'always' }

/** Whether a thing of stage `item` is drawn at `view`, in a room whose stages are `stages` in order. */
export function drawnAt(item: ItemStage, view: ViewStage, stages: readonly PhaseKey[]): boolean {
  if (view === 'full' || item === 'always') return true
  let at: ItemStage = item
  while (at !== 'always' && !stages.includes(at)) at = FALLBACK[at] ?? 'always'
  if (at === 'always') return true
  return stages.indexOf(at) <= stages.indexOf(view)
}

/** A piece of furniture's stage: a bathroom fixture comes with Jihozlar; in a kitchen the sink sits in its cabinet, so Mebel. */
export function furnitureStage(name: string, category: string | null | undefined, roomKind: string | undefined): PhaseKey {
  return ROLE_GROUP[inferRole(category ?? null, name)] === 'plumbing' && roomKind !== 'oshxona' ? 'jihozlar' : 'mebel'
}

/** The stage a wall covering was put on in: as recorded, else plaster → Suvoq, anything else → Bo'yoq. */
export function coveringStage(c: WallCovering): PhaseKey {
  return c.stage ?? (c.kind === 'plaster' ? 'suvoq' : 'boyoq')
}

/** How a wall looks at a stage before its own covering is on (existing materials only). */
export const BARE_WALL = {
  /** Bare masonry: the stucco relief in a dark grey. */
  quvurlar: { kind: 'paint', color: '#8F8B85' },
  suvoq: { kind: 'plaster' },
  /** Puttied: smooth and pale. */
  shpaklovka: { kind: 'paint', color: '#F1EFEA' },
} as const satisfies Partial<Record<PhaseKey, WallCovering>>

function bareWallAt(view: PhaseKey): WallCovering {
  return view === 'quvurlar' ? BARE_WALL.quvurlar : view === 'suvoq' ? BARE_WALL.suvoq : BARE_WALL.shpaklovka
}

/**
 * The design as the 3D should draw it at `view`: each wall's covering only from its own stage
 * (bare before), the ceiling, cornice, panels and backsplash from Bo'yoq, the floor and skirting
 * from Pol. 'full' returns `ds` itself, so the finished room renders exactly as before.
 */
export function stagedDesignState(ds: DesignState, view: ViewStage, stages: readonly PhaseKey[]): DesignState {
  if (view === 'full') return ds
  const at = (s: PhaseKey) => drawnAt(s, view, stages)
  // A raw plaster wall nobody put on in a stage (every new room's default) is the stage's bare look
  // until Bo'yoq: dark at Quvurlar, plaster at Suvoq, puttied at Shpaklovka.
  const own = (c: WallCovering | undefined) =>
    !c || (c.kind === 'plaster' && !c.stage ? at('boyoq') : at(coveringStage(c)))
  const wallsOwn = Object.values(ds.wallCoverings).every(own)
  const wallCoverings = wallsOwn ? ds.wallCoverings : Object.fromEntries(
    Object.entries(ds.wallCoverings).map(([k, c]) => [k, own(c) ? c : bareWallAt(view)]),
  ) as DesignState['wallCoverings']
  const out: DesignState = { ...ds, wallCoverings }
  if (!at('boyoq')) {
    out.ceiling = undefined
    out.ceilingState = undefined
    out.cornice = null
    out.backsplashes = undefined
    out.wallPanels = undefined
  }
  if (!at('pol')) {
    out.floorConfigured = false
    out.floorTexture = null
    out.floorPattern = null
    out.skirting = null
  }
  return out
}

/** What the banner can name as not there yet, in stage order. */
export type HiddenKind = 'electricals' | 'fixtures' | 'lights' | 'furniture'
const KIND_STAGE: Array<[HiddenKind, PhaseKey]> = [
  ['electricals', 'montaj'], ['fixtures', 'jihozlar'], ['lights', 'chiroq'], ['furniture', 'mebel'],
]

/** The kinds the room has (count > 0) that `view` does not draw yet. */
export function hiddenAt(view: ViewStage, stages: readonly PhaseKey[], counts: Record<HiddenKind, number>): HiddenKind[] {
  return KIND_STAGE.filter(([k, s]) => counts[k] > 0 && !drawnAt(s, view, stages)).map(([k]) => k)
}

/** `c` as put on at panel stage `phase`: tagged in Suvoq or Shpaklovka (coveringStage reads it), untagged elsewhere. */
export function withStageTag(c: WallCovering, phase: PhaseKey): WallCovering {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { stage: _old, ...rest } = c
  return phase === 'suvoq' || phase === 'shpaklovka' ? { ...rest, stage: phase } as WallCovering : rest as WallCovering
}
