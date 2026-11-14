import { beforeEach, describe, expect, it } from 'vitest'
import { useRoomStore } from '@/store/roomStore'
import type { RoomGeometry } from '@/store/types'
import { wallWalk } from '@/lib/plumbingRuns'
import { wallItemClashes } from '@/features/studio/wallItemClashes'

const geometry = { walls: [
  { id: 'A', length: 2500, elements: [] }, { id: 'B', length: 2000, elements: [] },
  { id: 'C', length: 2500, elements: [] }, { id: 'D', length: 2000, elements: [] },
] } as unknown as RoomGeometry
const st = () => useRoomStore.getState()
/** The couch (2.10 × 0.90 × 0.80 m) against wall A, centred `alongMm` along it, facing the room. */
function couchAt(alongMm: number) {
  const w = wallWalk(geometry).find((x) => x.id === 'A')!
  const t = alongMm / 1000
  return { id: 'c', furniture_id: 'couch_84', x: (w.startX + w.dirX * t + w.nx * 0.45) * 1000, y: (w.startZ + w.dirZ * t + w.nz * 0.45) * 1000, rotation: Math.atan2(w.nx, w.nz) }
}

beforeEach(() => {
  st().resetRoom()
  useRoomStore.setState({ geometry, catalogFurniture: [], userFurniture: [] })
})

describe('wallItemClashes', () => {
  it('nothing in the room: no clash', () => {
    expect(wallItemClashes(st())).toEqual({})
  })

  it('a machine in the couch: the machine names the couch', () => {
    useRoomStore.setState({ furniture: [couchAt(1250)], washers: [{ id: 'm', wallId: 'A', positionMm: 800 }] })
    expect(wallItemClashes(st())).toEqual({ m: ["Uch o'rinli divan"] })
  })

  it('a rail hung at 1 m above the 0.8 m couch does not touch it; one at 0.5 m does', () => {
    useRoomStore.setState({ furniture: [couchAt(1250)], towelRails: [{ id: 'r', wallId: 'A', positionMm: 1250, heightMm: 1000 }] })
    expect(wallItemClashes(st())).toEqual({})
    useRoomStore.setState({ towelRails: [{ id: 'r', wallId: 'A', positionMm: 1250, heightMm: 500 }] })
    expect(wallItemClashes(st())).toEqual({ r: ["Uch o'rinli divan"] })
  })

  it('on another wall: no clash', () => {
    useRoomStore.setState({ furniture: [couchAt(1250)], washers: [{ id: 'm', wallId: 'C', positionMm: 800 }] })
    expect(wallItemClashes(st())).toEqual({})
  })
})
