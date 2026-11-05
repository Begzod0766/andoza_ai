import { describe, it, expect } from 'vitest'
import { hangingDropM, lightType, HANG_HEADROOM_M, MIN_HANG_DROP_M } from '../lightCatalog'
import { fixturePose } from '@/components/studio/LightFixtures'
import type { PlacedLight } from '@/store/roomStore'

const pendant = lightType('pendant')
const chandelier = lightType('chandelier')
const at = (type: string, dropM?: number): PlacedLight => ({ id: 'l', xMm: 2000, zMm: 1500, type, ...(dropM === undefined ? {} : { dropM }) }) as PlacedLight

describe('a hanging light keeps head room (user report 2026-11-05: the pendant filled half a 2.4 m room)', () => {
  it('a pendant in a 2.4 m room hangs just under the ceiling, not down to eye height', () => {
    const drop = hangingDropM(at('pendant'), pendant, 2.4)
    expect(drop).toBe(MIN_HANG_DROP_M)
    // before: 0.9 m of cord left the shade's rim 1.22 m off the floor
    expect(2.4 - drop - pendant.sizeM.h).toBeGreaterThan(2.0)
  })

  it('keeps the rim at the head room line in a taller room, up to the catalog\'s own drop', () => {
    expect(2.7 - hangingDropM(at('pendant'), pendant, 2.7) - pendant.sizeM.h).toBeCloseTo(HANG_HEADROOM_M, 6)
    expect(hangingDropM(at('pendant'), pendant, 4.0)).toBe(pendant.dropM)
  })

  it('does the same for a chandelier', () => {
    // A 0.55 m chandelier on the shortest cord: its bottom is 1.80 m up, as high as it can be (was 1.25 m).
    expect(2.4 - hangingDropM(at('chandelier'), chandelier, 2.4) - chandelier.sizeM.h).toBeCloseTo(1.8, 6)
    expect(hangingDropM(at('chandelier'), chandelier, 4.0)).toBe(chandelier.dropM)
  })

  it('a drop the user set by hand is theirs', () => {
    expect(hangingDropM(at('pendant', 0.8), pendant, 2.4)).toBe(0.8)
  })

  it('the 3D pose hangs the body from the same drop', () => {
    const pose = fixturePose(at('pendant'), pendant, 4, 3, 2.4)
    expect(pose.y).toBeCloseTo(2.4 - MIN_HANG_DROP_M, 6)
    expect(pose.drop).toBeCloseTo(MIN_HANG_DROP_M, 6)
  })
})
