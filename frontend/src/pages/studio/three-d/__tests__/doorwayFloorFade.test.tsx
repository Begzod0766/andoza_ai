/**
 * A doorway's floor patch goes with its wall's cutaway fade, not before it.
 *
 * The patch used to be taken out the moment the cutaway faded its wall, while
 * the wall and the door lining in it ramp out over WallFade's ~200 ms: for
 * those frames the lining stood round a doorway with no floor in it (the
 * patch "popped"). Each patch is now in a WallFade of its own, told to hide
 * by the same faded-walls set as its wall, so it ramps with the very same
 * timing and opacity as the lining.
 */
import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import type { ReactNode } from 'react'

vi.mock('@react-three/fiber', () => ({
  useFrame: () => {},
  useThree: () => ({ gl: { capabilities: { getMaxAnisotropy: () => 1 } }, invalidate: () => {} }),
}))
// The fade is WallFade's, the one the walls use: record what each one is told.
vi.mock('@/features/studio/diorama', () => ({
  WallFade: ({ hidden, children }: { hidden: boolean; children: ReactNode }) => (
    <div data-testid="fade" data-hidden={String(hidden)}>{children}</div>
  ),
}))

import { DoorwayFloors } from '../FloorCeiling'

const rect = (x: number): [number, number][] => [[x, 0], [x + 0.9, 0], [x + 0.9, 0.2], [x, 0.2]]
const niches = [
  { wallId: '1', elId: 'door-1', polygon: rect(0) },
  { wallId: '2', elId: 'door-2', polygon: rect(2) },
]
const pattern = { id: 'herringbone', settings: {} } as Parameters<typeof DoorwayFloors>[0]['pattern']

describe('DoorwayFloors', () => {
  it('fades each patch with its own wall: hidden with a faded wall, shown with a standing one', () => {
    // r3f's tags render as unknown DOM elements here; React complains about the casing.
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { getAllByTestId } = render(
      <DoorwayFloors niches={niches} fadedWalls={new Set(['2'])} pattern={pattern} width={4} depth={3} fallbackColor="#c9ab7e" />,
    )
    expect(getAllByTestId('fade').map((f) => f.dataset.hidden)).toEqual(['false', 'true'])
  })
})
