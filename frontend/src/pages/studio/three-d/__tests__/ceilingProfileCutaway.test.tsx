/**
 * QA #10: a designed ceiling covered the room like a lid when looked at from
 * outside and above. The ABCD shell's <Ceiling> hid its dropped boxes for a
 * camera above the ceiling, but the drawn-room shell hangs <CeilingProfile>
 * directly and skipped that rule — so the cutaway now lives in CeilingProfile
 * itself, where every shell gets it.
 */
import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'

type FrameState = { camera: { position: { y: number } } }
const frames = vi.hoisted(() => ({ callbacks: [] as ((s: FrameState) => void)[] }))
vi.mock('@react-three/fiber', () => ({
  useFrame: (cb: (s: FrameState) => void) => { frames.callbacks.push(cb) },
  useThree: () => ({}),
}))

import { CeilingProfile } from '../FloorCeiling'

const parts = [
  { kind: 'panel', position: [0, 2.6, 0], size: [3, 0.1, 3] },
] as unknown as Parameters<typeof CeilingProfile>[0]['parts']

function frameAt(cameraY: number) {
  for (const cb of frames.callbacks) cb({ camera: { position: { y: cameraY } } })
}

describe('CeilingProfile cutaway', () => {
  it('hides the dropped ceiling for a camera above it and shows it again from inside', () => {
    // r3f's tags render as unknown DOM elements here; React complains about the casing.
    vi.spyOn(console, 'error').mockImplementation(() => {})
    frames.callbacks.length = 0
    const { container } = render(<CeilingProfile parts={parts} color="#fff" stripK={3000} ceilingY={2.7} />)
    const group = container.querySelector('group') as unknown as { visible?: boolean }
    frameAt(8)
    expect(group.visible).toBe(false)
    frameAt(1.6)
    expect(group.visible).toBe(true)
  })
})
