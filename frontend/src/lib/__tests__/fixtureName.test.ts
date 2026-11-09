import { describe, it, expect } from 'vitest'
import i18n from '@/i18n'
import { fixtureDisplayName } from '../fixtureName'

const en = i18n.getFixedT('en'), ru = i18n.getFixedT('ru'), uz = i18n.getFixedT('uz')

describe('a fixture name in the reader\'s language (mobile QA 2026-11-09 #5)', () => {
  it('the Uzbek fixture word becomes the role, the rest of the name is kept', () => {
    expect(fixtureDisplayName('Vanna 1', en)).toBe('Bathtub 1')
    expect(fixtureDisplayName('Rakovina 3', en)).toBe('Sink 3')
    expect(fixtureDisplayName('Unitaz', en)).toBe('Toilet')
    expect(fixtureDisplayName('Dush 2', ru)).toBe('Душ 2')
    expect(fixtureDisplayName('Vanna Roca 170', ru)).toBe('Ванна Roca 170')
  })
  it('Uzbek, and a piece that is not a fixture, are left as they are', () => {
    expect(fixtureDisplayName('Vanna 1', uz)).toBe('Vanna 1')
    expect(fixtureDisplayName('Ванна акриловая', uz)).toBe('Ванна акриловая')
    expect(fixtureDisplayName('Divan Milano', en)).toBe('Divan Milano')
  })
})
