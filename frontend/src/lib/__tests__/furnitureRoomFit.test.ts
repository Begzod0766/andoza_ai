import { describe, it, expect } from 'vitest'
import { fitsCatalogRoom } from '../furnitureRoomFit'
import type { CatalogFurniture } from '@/lib/api'

const item = (name: string, category: string, room_type: string | null) =>
  ({ id: name, name_uz: name, category, room_type } as CatalogFurniture)

describe('fitsCatalogRoom: which catalog pieces a room offers', () => {
  it("a piece filed under the room is offered there, and not in another room", () => {
    expect(fitsCatalogRoom(item('Vanna 5', 'boshqa', 'hammom'), 'hammom')).toBe(true)
    expect(fitsCatalogRoom(item('Vanna 5', 'boshqa', 'hammom'), 'mehmonxona')).toBe(false)
  })

  it('a piece with no room of its own goes where what it is for belongs (prod 2026-11-07: desks in the bathroom)', () => {
    expect(fitsCatalogRoom(item('Стол Nord', 'stol', null), 'hammom')).toBe(false)
    expect(fitsCatalogRoom(item('Стеллаж Aurora', 'shkaf', null), 'hammom')).toBe(false)
    expect(fitsCatalogRoom(item('Стол Nord', 'stol', null), 'mehmonxona')).toBe(true)
    expect(fitsCatalogRoom(item('Стеллаж Aurora', 'shkaf', null), 'yotoqxona')).toBe(true)
    expect(fitsCatalogRoom(item('Диван Лофт', 'divan', null), 'oshxona')).toBe(false)
    expect(fitsCatalogRoom(item('Обеденный стул ERGO Jardin', 'stul', null), 'oshxona')).toBe(true)
  })

  it('a rug or a decorative piece with no room suits every room', () => {
    for (const room of ['mehmonxona', 'oshxona', 'yotoqxona', 'hammom']) {
      expect(fitsCatalogRoom(item('Gilam 1', 'gilam', null), room)).toBe(true)
      expect(fitsCatalogRoom(item("O'simlik", 'dekor', null), room)).toBe(true)
    }
  })
})
