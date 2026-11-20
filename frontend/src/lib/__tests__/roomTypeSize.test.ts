import { describe, expect, it } from 'vitest'
import type { RoomGeometry } from '@/store/types'
import { ROOM_TYPE_SIZE_MM, sizeForType } from '@/lib/roomTypeSize'

const rect = (a: number, b: number, els: unknown[] = []): RoomGeometry => ({ walls: [
  { id: 'A', length: a, elements: els }, { id: 'B', length: b, elements: [] },
  { id: 'C', length: a, elements: [] }, { id: 'D', length: b, elements: [] },
] }) as unknown as RoomGeometry

describe('ROOM_TYPE_SIZE_MM', () => {
  it('every room type has its usual size', () => {
    expect(ROOM_TYPE_SIZE_MM).toEqual({
      hammom: [2500, 2000], oshxona: [3000, 3000], yotoqxona: [4000, 3500], bolalar: [3500, 3000],
      mehmonxona: [5000, 4000], kabinet: [3000, 2500], balkon: [3000, 1200],
    })
  })
})

describe('sizeForType', () => {
  it('an untouched 4 × 3 room takes the picked type’s size', () => {
    expect(sizeForType(rect(4000, 3000), null, 'hammom')).toEqual({ A: 2500, B: 2000, C: 2500, D: 2000 })
  })
  it('a room still at the last picked type’s size takes the new one', () => {
    expect(sizeForType(rect(2500, 2000), 'hammom', 'oshxona')).toEqual({ A: 3000, B: 3000, C: 3000, D: 3000 })
  })
  it('back to no type: back to 4 × 3', () => {
    expect(sizeForType(rect(2500, 2000), 'hammom', null)).toEqual({ A: 4000, B: 3000, C: 4000, D: 3000 })
  })
  it('walls the user set are left alone', () => {
    expect(sizeForType(rect(3200, 2100), null, 'hammom')).toBeNull()
    expect(sizeForType(rect(4000, 3000), 'hammom', 'oshxona')).toBeNull()
  })
  it('a room with a door or window already is left alone', () => {
    expect(sizeForType(rect(4000, 3000, [{ id: 'd', type: 'eshik', position: 0, width: 700 }]), null, 'hammom')).toBeNull()
  })
  it('a room that is not the 4-wall rectangle is left alone', () => {
    const six = { walls: ['A', 'B', 'C', 'D', 'E', 'F'].map((id) => ({ id, length: 4000, elements: [] })) } as unknown as RoomGeometry
    expect(sizeForType(six, null, 'hammom')).toBeNull()
  })
  it('the same size already: nothing to do', () => {
    expect(sizeForType(rect(4000, 3000), null, null)).toBeNull()
  })
})
