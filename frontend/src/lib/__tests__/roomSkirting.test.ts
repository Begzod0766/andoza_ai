/**
 * Which skirting a room draws (2026-11-18): a bathroom tiled on the floor is tiled
 * to the wall foot, so it gets no board unless the user puts one on — the estimate
 * (backend smeta._skirting_lines) reads the same rule.
 */
import { describe, it, expect } from 'vitest'
import { roomSkirting } from '../trimProfiles'

const board = { id: 'b052', heightMm: 119, widthMm: 18 }

describe('roomSkirting', () => {
  it('a bathroom with a tile floor has none by default', () => {
    expect(roomSkirting({ floorType: 'tile' }, true)).toBeNull()
  })
  it('a skirting the user put on a bathroom stays', () => {
    expect(roomSkirting({ floorType: 'tile', skirting: board }, true)?.def.id).toBe('b052')
  })
  it('one the user took off is off in any room', () => {
    expect(roomSkirting({ floorType: 'laminate', skirting: null }, false)).toBeNull()
  })
  it('any other room keeps the default board', () => {
    expect(roomSkirting({ floorType: 'tile' }, false)?.def.id).toBe('tekis')
    expect(roomSkirting({ floorType: 'laminate' }, true)?.def.id).toBe('tekis')
  })
})
