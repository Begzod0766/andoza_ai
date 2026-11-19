/** Kitchen QA 2026-11-18 K9: the wall paint list showed alkyd enamels, which are for metal and wood. */
import { describe, it, expect } from 'vitest'
import { isWallPaint } from '../wallPaint'

describe('isWallPaint', () => {
  it('an enamel is not a wall paint, in any of the shops\' spellings', () => {
    for (const n of ['Inoria MATT ALKYD ENAMEL (инория ) 3,75 LT', 'Inoria LUX ALKYD ENAMEL PORLOQ 0,75 LT', 'Эмаль ПФ-115 белая', 'PF-115 emal oq', 'Алкидная краска'])
      expect(isWallPaint(n)).toBe(false)
  })
  it('a wall paint is', () => {
    for (const n of ['Tikkurila Euro 3 Oq', 'Краска Polisan Perla матовая 2,5 л', 'Dulux Mos Sariq', 'Akril devor bo\'yog\'i', 'Emulsiya oq'])
      expect(isWallPaint(n)).toBe(true)
  })
})
