import { describe, expect, it } from 'vitest'
import { roomCopyStamp } from '@/lib/roomCopyStamp'

describe('roomCopyStamp (#359): the copy the store holds outlives the studio page', () => {
  it('a new handle for the same room reads the stamp written before', () => {
    roomCopyStamp('A').current = '2026-11-21T10:00:00Z'
    expect(roomCopyStamp('A').current).toBe('2026-11-21T10:00:00Z')
  })
  it("another room reads none: a 404 there is not taken for this room's deletion", () => {
    roomCopyStamp('A').current = '2026-11-21T10:00:00Z'
    expect(roomCopyStamp('B').current).toBeNull()
    expect(roomCopyStamp(undefined).current).toBeNull()
  })
})
