/**
 * Two openings on one wall, one explicit and one auto (resolveElementPositions).
 *
 * The pair used to be re-laid together whenever EITHER was auto, so a door the
 * user had just dragged (now explicit) jumped back to the pair's centred spot
 * on release if its wall still held an auto window. The explicit one is the
 * user's and stays exactly where it is; only the auto one is placed.
 */
import { describe, expect, it } from 'vitest'
import type { WallElement } from '@/store/roomStore'
import { resolveElementPositions } from '../wallPositions'

const el = (id: string, width: number, position: number, positionAuto?: boolean): WallElement => ({
  id, type: id.startsWith('d') ? 'eshik' : 'deraza', width, height: 2000, sill_height: 0, position,
  ...(positionAuto === undefined ? {} : { positionAuto }),
})

describe('resolveElementPositions, a pair', () => {
  it('both auto: still centred together with the 400 mm gap', () => {
    const r = resolveElementPositions([el('d', 900, 0, true), el('w', 1200, 0, true)], 5000)
    expect(r.map((e) => e.position)).toEqual([1250, 2550])
  })

  it('both explicit: kept as they are', () => {
    const r = resolveElementPositions([el('d', 900, 100, false), el('w', 1200, 3000, false)], 5000)
    expect(r.map((e) => e.position)).toEqual([100, 3000])
  })

  it.each([
    ['explicit first', 0],
    ['explicit second', 1],
  ])('%s: the explicit one is not moved; the auto one is centred in the wider free stretch', (_n, explicitIdx) => {
    const fixed = el('d', 900, 150, false)
    const auto = el('w', 1200, 0, true)
    const input = explicitIdx === 0 ? [fixed, auto] : [auto, fixed]
    const r = resolveElementPositions(input, 5000)
    expect(r.find((e) => e.id === 'd')!.position).toBe(150)
    // Free stretch right of the door: 1050..5000, centre 3025.
    expect(r.find((e) => e.id === 'w')!.position).toBe(3025 - 600)
    // Order (the wall's element order) is kept.
    expect(r.map((e) => e.id)).toEqual(input.map((e) => e.id))
  })

  it('the auto one goes left when the explicit one sits near the right end, and stays on the wall', () => {
    const r = resolveElementPositions([el('d', 900, 3900, false), el('w', 1200, 0, true)], 5000)
    expect(r[0].position).toBe(3900)
    expect(r[1].position).toBe(1950 - 600)
    // A partner wider than either stretch still stays on the wall.
    const tight = resolveElementPositions([el('d', 900, 2000, false), el('w', 3000, 0, true)], 4000)
    expect(tight[0].position).toBe(2000)
    expect(tight[1].position).toBeGreaterThanOrEqual(0)
    expect(tight[1].position + 3000).toBeLessThanOrEqual(4000)
  })

  it('a legacy explicit element (no flag, position > 0) is honoured the same way', () => {
    const r = resolveElementPositions([el('d', 900, 600), el('w', 1200, 0)], 5000)
    expect(r[0].position).toBe(600)
  })
})
