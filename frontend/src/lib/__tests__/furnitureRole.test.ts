import { describe, it, expect } from 'vitest'
import { inferRole, isRole, ROLE_GROUP } from '../furnitureRole'

describe('furniture roles', () => {
  it.each([
    ['boshqa', 'Jun gilam', 'rug'], ['stol', 'Jurnal stoli', 'coffee_table'],
    ['boshqa', 'TV tumba', 'tv_unit'], ['stol', 'Tumbochka', 'nightstand'],
    ['stol', 'Yozuv stoli', 'desk'], ['divan', 'Kreslo Milano', 'armchair'],
    ['shkaf', 'Garderob', 'wardrobe'], ['shkaf', 'Kitob javoni', 'shelf'],
    ['divan', 'Divan Roma', 'sofa'], ['karavot', 'Karavot', 'bed'],
    ['stol', 'Ovqat stoli', 'dining_table'], ['stul', 'Stul', 'dining_chair'],
    ['boshqa', 'Puf', 'decor'],
    ['stul', 'Ish stuli', 'desk_chair'], ['stul', 'Office chair', 'desk_chair'],
    ['kreslo', 'Kompyuter stuli', 'desk_chair'], ['stul', 'Офисное кресло', 'desk_chair'],
    ['divan', 'Kreslo', 'armchair'],
    ['stol', 'Компьютерный стол', 'desk'], ['kreslo', 'Компьютерное кресло', 'desk_chair'],
    ['stul', 'Офисный стул', 'desk_chair'],
    // "ovqatlanish" ends in "ish": a dining chair or table is not a desk chair or desk
    ['stul', 'KLEIN ovqatlanish stuli', 'dining_chair'], ['stol', 'NARVI ovqatlanish stoli — oq', 'dining_table'],
    ['stul', 'Ish stuli Pro', 'desk_chair'], ['stol', 'Ish stoli', 'desk'],
    // Russian catalogue names: without these a shelf or wardrobe fell through to decor
    ['boshqa', 'Стеллаж', 'shelf'], ['boshqa', 'СТЕЛЛАЖ металлический', 'shelf'], ['boshqa', 'Комод', 'shelf'],
    ['boshqa', 'Витрина', 'shelf'], ['boshqa', 'Шкаф', 'wardrobe'], ['boshqa', 'Шкаф-купе', 'wardrobe'],
    ['boshqa', 'Гардероб', 'wardrobe'], ['boshqa', 'Кресло дизайнерское', 'armchair'],
    ['boshqa', 'Тумбочка', 'nightstand'], ['boshqa', 'Прикроватная тумба', 'nightstand'],
    ['boshqa', 'ТВ-тумба', 'tv_unit'], ['boshqa', 'Тумба под телевизор', 'tv_unit'], ['boshqa', 'Стойка ТВ', 'tv_unit'],
    ['boshqa', 'Журнальный столик', 'coffee_table'], ['boshqa', 'Кофейный стол', 'coffee_table'],
    ['boshqa', 'Ковёр шерстяной', 'rug'], ['boshqa', 'Ковер', 'rug'], ['boshqa', 'Ковры', 'rug'],
    ['stol', 'Письменный стол', 'desk'],
    // "тв" only as a word: a hard pouf is decor, not a TV stand
    ['boshqa', 'Твёрдый пуф', 'decor'], ['boshqa', 'Пуф', 'decor'],
    // Russian "Стол <name>": a shop's office desk (Loftbek); a dining table says "обеденный" or "кухонный"
    ['stol', 'Стол Axis', 'desk'],
    ['stol', 'Стол Nord', 'desk'],
    ['stol', 'Стол RS-3 (Rombik)', 'desk'],
    ['stol', 'Стол 1927', 'desk'],
    ['stol', 'СТОЛ GOODZONE', 'desk'],
    ['stol', 'Стол', 'desk'],
    ['stol', 'Офисный стол', 'desk'],
    ['stol', 'Рабочий стол Loft', 'desk'],
    ['stol', 'Стол обеденный Maria', 'dining_table'],
    ['stol', 'Обеденный стол, DTA-04', 'dining_table'],
    ['stol', 'Раскладной обеденный стол', 'dining_table'],
    ['stol', 'Кухонный стол', 'dining_table'],
    ['stol', 'Стол кухонный Oslo', 'dining_table'],
    // a hyphenated "Стол-..." is a folding / transforming table, not a desk
    ['stol', 'Стол-книжка', 'dining_table'],
    ['stol', 'Стол журнальный Lunar', 'coffee_table'],
    // a meeting table seats people round it, as a dining table does
    ['stol', 'Переговорный стол №1', 'dining_table'],
    // a bare Latin name has nothing to go on: the category decides
    ['stol', 'Horizon', 'dining_table'],
    ['stul', 'Стул Axis', 'dining_chair'],
    // a shkaf with a bare model name (Loftbek): the category makes it storage, open shelving by default
    ['shkaf', 'LOFT', 'shelf'],
    ['shkaf', 'Practical PRO', 'shelf'],
    ['shkaf', 'Quadro', 'shelf'],
    // the name still decides when it says what the piece is
    ['shkaf', 'Шкаф Quadro', 'wardrobe'],
    ['shkaf', 'Kiyim shkafi', 'wardrobe'],
  ])('%s / %s is %s', (category, name, role) => {
    expect(inferRole(category, name)).toBe(role)
  })

  it('copes with a missing category', () => {
    expect(inferRole(null, 'Puf')).toBe('decor')
    expect(inferRole(undefined, 'Divan')).toBe('decor')
  })

  it('groups roles', () => {
    expect(ROLE_GROUP.dining_chair).toBe('dining')
    expect(ROLE_GROUP.rug).toBe('extra')
  })

  it('isRole accepts only the 19 roles (14 furniture, 5 plumbing)', () => {
    expect(Object.keys(ROLE_GROUP)).toHaveLength(19)
    expect(isRole('sofa')).toBe(true)
    expect(isRole('throne')).toBe(false)
    expect(isRole(3)).toBe(false)
  })
})

describe('plumbing fixture roles (spec 2026-11-08: the shop files them all under "boshqa")', () => {
  it.each([
    ['Vanna 1', 'bathtub'], ['Ванна акриловая', 'bathtub'], ['Bathtub', 'bathtub'],
    ['Rakovina 3', 'sink'], ['Раковина', 'sink'], ['Umivalnik', 'sink'],
    ['Unitaz', 'toilet'], ['Унитаз', 'toilet'],
    ['Dush 2', 'shower'], ['Душевая кабина', 'shower'],
    ['Bide', 'bidet'], ['Биде', 'bidet'],
  ])('%s is a %s', (name, role) => {
    expect(inferRole('boshqa', name)).toBe(role)
  })

  it('a bathroom cabinet is not a bathtub, and a Monday is not a shower', () => {
    expect(inferRole('shkaf', 'Шкаф для ванной комнаты')).not.toBe('bathtub')
    expect(inferRole('shkaf', 'Vanna shkafi')).not.toBe('bathtub')
    expect(inferRole('boshqa', 'Dushanba stoli')).not.toBe('shower')
  })

  it('the five sit in the plumbing group', () => {
    for (const r of ['bathtub', 'sink', 'toilet', 'shower', 'bidet'] as const) expect(ROLE_GROUP[r]).toBe('plumbing')
  })
})
