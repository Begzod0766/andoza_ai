import { describe, it, expect } from 'vitest'
import i18n from '@/i18n'

describe('mebel counts read right in every language', () => {
  it('English: 1 cabinet, 2 cabinets; 1 sheet; 1 part', () => {
    const t = i18n.getFixedT('en')
    expect(t('mebel.list.cabinets', { count: 1 })).toBe('1 cabinet')
    expect(t('mebel.list.cabinets', { count: 2 })).toBe('2 cabinets')
    expect(t('mebel.list.free_parts', { count: 1 })).toBe('1 free part')
    expect(t('mebel.summary.sheets', { count: 1 })).toBe('1 sheet')
    expect(t('mebel.summary.parts', { count: 1 })).toBe('1 part')
    expect(t('mebel.summary.offcuts', { count: 1 })).toBe('1 offcut')
  })
  it('Russian: 1 шкаф, 2 шкафа, 5 шкафов', () => {
    const t = i18n.getFixedT('ru')
    expect(t('mebel.list.cabinets', { count: 1 })).toBe('1 шкаф')
    expect(t('mebel.list.cabinets', { count: 2 })).toBe('2 шкафа')
    expect(t('mebel.list.cabinets', { count: 5 })).toBe('5 шкафов')
  })
  it('Uzbek keeps one form: 1 shkaf, 6 shkaf', () => {
    const t = i18n.getFixedT('uz')
    expect(t('mebel.list.cabinets', { count: 1 })).toBe('1 shkaf')
    expect(t('mebel.list.cabinets', { count: 6 })).toBe('6 shkaf')
  })
})
