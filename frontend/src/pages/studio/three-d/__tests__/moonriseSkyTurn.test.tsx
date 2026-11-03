import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

const seen = vi.hoisted(() => ({ props: null as null | Record<string, unknown> }))
vi.mock('@/components/studio/SafeEnvironment', () => ({
  SafeEnvironment: (p: Record<string, unknown>) => { seen.props = p; return null },
}))
vi.mock('@react-three/postprocessing', () => ({ EffectComposer: () => null, N8AO: () => null, SMAA: () => null }))

import { MoonriseSky, MOON_TURN_Y } from '../SceneEnvironment'
import { MOONRISE_BACKGROUND_INTENSITY } from '@/lib/moonriseSky'

describe('MoonriseSky', () => {
  it('turns the sky half a circle so the moon sits behind the opening view, not glaring at the top of it', () => {
    // A <color> child is fine in jsdom's React tree: only the props passed on matter here.
    render(<MoonriseSky />)
    expect(MOON_TURN_Y).toBeCloseTo(Math.PI)
    expect(seen.props?.backgroundRotation).toEqual([0, MOON_TURN_Y, 0])
    expect(seen.props?.environmentRotation).toEqual([0, MOON_TURN_Y, 0])
  })

  it('keeps the tuned backdrop brightness', () => {
    render(<MoonriseSky />)
    expect(seen.props?.backgroundIntensity).toBe(MOONRISE_BACKGROUND_INTENSITY)
  })
})
