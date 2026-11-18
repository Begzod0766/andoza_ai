import type { TKey } from '@/i18n'

/**
 * Renovation phases — the left-hand stepper in the studio, and the key the
 * design panel switches its sections on.
 *
 * Defined once here because the list previously existed twice (the page and
 * the panel each had their own copy) and they drifted: adding a phase to one
 * left the other rejecting it as an impossible value.
 */
export type PhaseKey =
  | 'quvurlar'
  | 'suvoq'
  | 'shpaklovka'
  | 'boyoq'
  | 'pol'
  | 'montaj'
  | 'jihozlar'
  | 'chiroq'
  | 'mebel'

export const RENO_STAGES: Array<{ key: PhaseKey; labelKey: TKey }> = [
  { key: 'quvurlar', labelKey: 'studio.lib.stage.quvurlar' },
  { key: 'suvoq', labelKey: 'studio.lib.stage.suvoq' },
  { key: 'shpaklovka', labelKey: 'studio.lib.stage.shpaklovka' },
  { key: 'boyoq', labelKey: 'studio.lib.stage.boyoq' },
  { key: 'pol', labelKey: 'studio.lib.stage.pol' },
  { key: 'montaj', labelKey: 'studio.lib.stage.montaj' },
  { key: 'jihozlar', labelKey: 'studio.lib.stage.jihozlar' },
  { key: 'chiroq', labelKey: 'studio.lib.stage.chiroq' },
  { key: 'mebel', labelKey: 'studio.lib.stage.mebel' },
]

/**
 * The two plumbing stages (spec 2026-11-18, once one "Santexnika"): Quvurlar, the pipes run before
 * the walls are plastered, and Jihozlar, the fixtures set after the tiles and the floor.
 */
const PLUMBING_PHASES = new Set<string>(['quvurlar', 'jihozlar'])

/** Whether `phase` is Quvurlar or Jihozlar. */
export function isPlumbingPhase(phase: string): boolean {
  return PLUMBING_PHASES.has(phase)
}

/** Catalog room kinds with plumbing: the plumbing stages show only there (spec 2026-11-08). */
const PLUMBING_ROOMS = new Set(['hammom', 'oshxona'])

/** The stages a room of catalog kind `roomKind` shows: no plumbing stages outside a bathroom or kitchen. */
export function visibleStages(roomKind: string | undefined): typeof RENO_STAGES {
  return roomKind && PLUMBING_ROOMS.has(roomKind) ? RENO_STAGES : RENO_STAGES.filter((s) => !isPlumbingPhase(s.key))
}

/** The link's `?phase=` as a stage this room has (an old `santexnika` is Jihozlar), else null. */
function linkedStage(phaseParam: string | null, roomKind: string | undefined): PhaseKey | null {
  const wanted = phaseParam === 'santexnika' ? 'jihozlar' : phaseParam
  return visibleStages(roomKind).some((s) => s.key === wanted) ? (wanted as PhaseKey) : null
}

type OpenArgs = { phaseParam: string | null; roomKind: string | undefined; tab?: 'mebel' | 'chiroq' }

/**
 * The stage the studio opens at: the Mebel or Chiroq tab's own, else the link's `?phase=` when the
 * room has that stage (the plumbing ones only in a bathroom or kitchen), else the last stage, Mebel:
 * with no link the studio opens on the finished room (spec 2026-11-18; was Bo'yoq).
 */
export function initialPhaseFor(args: OpenArgs): PhaseKey {
  if (args.tab) return args.tab
  return linkedStage(args.phaseParam, args.roomKind) ?? 'mebel'
}

/**
 * The stage the 3D opens at (lib/stageView): the link's own stage when it names one the room has
 * (the mobile wizard and wall-condition hand-off), else the finished room. A tab always opens finished.
 */
export function initialViewStage(args: OpenArgs): PhaseKey | 'full' {
  if (args.tab) return 'full'
  return linkedStage(args.phaseParam, args.roomKind) ?? 'full'
}
