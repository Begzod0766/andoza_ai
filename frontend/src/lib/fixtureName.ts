import type { TFunction } from 'i18next'
import i18n from '@/i18n'
import { inferRole } from '@/lib/furnitureRole'

/**
 * A plumbing fixture's name in the reader's language (mobile QA 2026-11-09 #5). Shop names are
 * Uzbek ("Vanna 1", "Rakovina 3"): in English or Russian the fixture word becomes what the piece is
 * ("Bathtub 1", "Раковина 3") and the rest of the name, the model, is kept. Uzbek, and a piece that
 * is not a fixture, are left as they are. backend/app/services/smeta_text.py does the same for the PDF.
 */
const FIXTURE_WORD: Record<string, RegExp> = {
  bathtub: /\S*(?:ванна|vanna|bathtub)\S*/i,
  sink: /\S*(?:rakovina|umivalnik|moyka|раковин|умывальник|мойк|sink|washbasin)\S*/i,
  toilet: /\S*(?:unitaz|унитаз|toilet|\bwc\b)\S*/i,
  shower: /\S*(?:dush|душ|shower)\S*/i,
  bidet: /\S*(?:bide|биде|bidet)\S*/i,
}

export function fixtureDisplayName(name: string, t: TFunction): string {
  const lng = (t as unknown as { lng?: string }).lng ?? i18n.language
  if (!lng || lng.startsWith('uz')) return name
  const role = inferRole(null, name)
  const word = FIXTURE_WORD[role]
  if (!word) return name
  const rest = name.replace(word, '').replace(/\s+/g, ' ').trim()
  const label = t(`smeta.line.fixture_${role}` as 'smeta.line.fixture_bathtub')
  return rest ? `${label} ${rest}` : label
}
