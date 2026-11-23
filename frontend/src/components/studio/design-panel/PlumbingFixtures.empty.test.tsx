/** The "no fixtures yet" line in the plumbing panel (phone QA #392 2a): it said so over a room with a rail and machines. */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useRoomStore } from '@/store/roomStore'
import type { RoomGeometry } from '@/store/types'
import { PlumbingFixtures } from './PlumbingFixtures'

const geometry = { walls: [
  { id: 'A', length: 2500, elements: [] }, { id: 'B', length: 2000, elements: [] },
  { id: 'C', length: 2500, elements: [] }, { id: 'D', length: 2000, elements: [] },
] } as unknown as RoomGeometry
const EMPTY = /Hali jihoz yo'q/

beforeEach(() => {
  useRoomStore.getState().resetRoom()
  useRoomStore.setState({ geometry, roomType: 'hammom', catalogFurniture: [] })
})

describe('PlumbingFixtures: the empty line', () => {
  it('shows in a room with nothing plumbed in', () => {
    render(<PlumbingFixtures />)
    expect(screen.getByText(EMPTY)).toBeInTheDocument()
  })

  it('is gone once the room has a towel rail', () => {
    useRoomStore.setState({ towelRails: [{ id: 'r', wallId: 'A', positionMm: 1250, heightMm: 600 }] })
    render(<PlumbingFixtures />)
    expect(screen.queryByText(EMPTY)).toBeNull()
  })

  it('is gone once the room has a machine', () => {
    useRoomStore.setState({ washers: [{ id: 'm', wallId: 'B', positionMm: 1000 }] })
    render(<PlumbingFixtures />)
    expect(screen.queryByText(EMPTY)).toBeNull()
  })
})
