/** The pipe money (spec 2026-11-24 D): the front's pipeCost against the hand-worked fixture. */
import { describe, it, expect } from 'vitest'
import type { PlumbingPoint, RoomGeometry } from '@/store/types'
import { pipeScheme, EMPTY_SCHEME, type PipeRoute } from '@/lib/pipeScheme'
import { pipeCost, type PlumbingPrices } from '@/lib/pipeCost'
import scheme from './fixtures/pipeScheme.json'
import money from './fixtures/pipeCost.json'

interface SchemeCase { name: string; geometry: unknown; riser: { wallId: string; positionMm: number }; points: unknown[]; collector?: boolean; route?: PipeRoute }
interface CostCase { name: string; caseName: string; route?: PipeRoute; collectorShopUzs?: number; pipesInWall: boolean; expectedUzs: number }
const prices = money.prices as PlumbingPrices

describe('pipeCost', () => {
  for (const c of money.cases as CostCase[]) {
    it(c.name, () => {
      const base = (scheme.cases as SchemeCase[]).find((s) => s.name === c.caseName)
      expect(base, c.caseName).toBeDefined()
      const route = c.route ?? base!.route ?? {}
      const s = pipeScheme(base!.geometry as RoomGeometry, base!.riser, base!.points as PlumbingPoint[], base!.collector ?? false, route)
      const p = c.collectorShopUzs ? { ...prices, collector: { ...prices.collector, shop_uzs: c.collectorShopUzs } } : prices
      expect(pipeCost(s, p, { pipesInWall: c.pipesInWall, waterTrunkInFloor: route.waterTrunk === 'floor' })).toBe(c.expectedUzs)
    })
  }
  it('an empty scheme costs nothing', () => {
    expect(pipeCost(EMPTY_SCHEME, prices, { pipesInWall: true, waterTrunkInFloor: false })).toBe(0)
  })
})
