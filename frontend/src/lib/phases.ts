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
  | 'suvoq'
  | 'shpaklovka'
  | 'boyoq'
  | 'pol'
  | 'montaj'
  | 'santexnika'
  | 'chiroq'
  | 'mebel'

export const RENO_STAGES: Array<{ key: PhaseKey; labelKey: TKey }> = [
  { key: 'suvoq', labelKey: 'studio.lib.stage.suvoq' },
  { key: 'shpaklovka', labelKey: 'studio.lib.stage.shpaklovka' },
  { key: 'boyoq', labelKey: 'studio.lib.stage.boyoq' },
  { key: 'pol', labelKey: 'studio.lib.stage.pol' },
  { key: 'montaj', labelKey: 'studio.lib.stage.montaj' },
  { key: 'santexnika', labelKey: 'studio.lib.stage.santexnika' },
  { key: 'chiroq', labelKey: 'studio.lib.stage.chiroq' },
  { key: 'mebel', labelKey: 'studio.lib.stage.mebel' },
]

/** Catalog room kinds with plumbing: the "Santexnika" stage shows only there (spec 2026-11-08). */
const PLUMBING_ROOMS = new Set(['hammom', 'oshxona'])

/** The stages a room of catalog kind `roomKind` shows: all but "Santexnika" outside a bathroom or kitchen. */
export function visibleStages(roomKind: string | undefined): typeof RENO_STAGES {
  return roomKind && PLUMBING_ROOMS.has(roomKind) ? RENO_STAGES : RENO_STAGES.filter((s) => s.key !== 'santexnika')
}
