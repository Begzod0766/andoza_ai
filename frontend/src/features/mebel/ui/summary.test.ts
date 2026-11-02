import { describe, it, expect } from 'vitest'
import type { Result } from '@/features/mebel/engine'
import { summarize } from './summary'

const sheet = (stockId?: string) => ({ placements: [], cuts: [], offcuts: [], utilization: 0.5, size: { length: 2800, width: 2070 }, ...(stockId ? { stockId } : {}) })

describe('summarize', () => {
  it('counts sheets and store offcuts apart, sums edge metres (1 dp), pieces, total and warnings', () => {
    const result = {
      nesting: [
        { sheets: [sheet(), sheet(), sheet('s1')] },
        { sheets: [sheet()] },
      ],
      edgeTotals: [{ metersWithWaste: 30.04 }, { metersWithWaste: 12.48 }],
      groups: [{ qty: 4 }, { qty: 2 }, { qty: 180 }],
      total: 4_820_000,
      warnings: [{}, {}, {}],
    } as unknown as Result
    expect(summarize(result)).toEqual({ sheets: 3, offcuts: 1, edgeMeters: 42.5, parts: 186, total: 4_820_000, warnings: 3 })
  })

  it('an unpriced project keeps total null', () => {
    const result = { nesting: [], edgeTotals: [], groups: [], total: null, warnings: [] } as unknown as Result
    expect(summarize(result)).toMatchObject({ sheets: 0, edgeMeters: 0, parts: 0, total: null, warnings: 0 })
  })
})
