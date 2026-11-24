/** The pipe money (spec 2026-11-24 D): what the estimate (backend smeta.py) charges for a pipe scheme. */
import type { PipeScheme } from '@/lib/pipeScheme'

export interface PlumbingPrices {
  reserve: number
  pipe_m_uzs: { water_20: number; drain_50: number; drain_110: number }
  fitting_uzs: Record<keyof PipeScheme['fittings'], number>
  collector: { shop_uzs: number | null; base_uzs: number; outlet_uzs: number; work_uzs: number }
  chase_m_uzs: { water_20: number; drain_50: number }
}

const round2 = (x: number) => Math.floor(x * 100 + 0.5) / 100

/** smeta._make_line: the subtotal in tiyin, floored to so'm. A line with nothing to count is not emitted. */
const line = (qty: number, priceUzs: number) => (qty > 0 ? Math.floor(Math.round(qty * Math.round(priceUzs * 100)) / 100) : 0)

export function pipeCost(s: PipeScheme, p: PlumbingPrices, o: { pipesInWall: boolean; waterTrunkInFloor: boolean }): number {
  let total = 0
  for (const kind of ['drain_50', 'drain_110', 'water_20'] as const) {
    const mm = s.pipes[kind].trunkMm + s.pipes[kind].branchMm
    if (mm > 0) total += line(round2((mm / 1000) * p.reserve), p.pipe_m_uzs[kind])
  }
  for (const key of Object.keys(p.fitting_uzs) as Array<keyof PipeScheme['fittings']>) {
    total += line(s.fittings[key], p.fitting_uzs[key])
  }
  let collectors = 0
  for (const outlets of [s.collectors.cold, s.collectors.hot]) {
    if (!outlets) continue
    collectors += 1
    total += line(1, p.collector.shop_uzs ?? p.collector.base_uzs + outlets * p.collector.outlet_uzs)
  }
  total += line(collectors, p.collector.work_uzs)
  if (o.pipesInWall) {
    const w = s.pipes.water_20
    total += line(round2((o.waterTrunkInFloor ? w.branchMm : w.trunkMm + w.branchMm) / 1000), p.chase_m_uzs.water_20)
    total += line(round2(s.pipes.drain_50.branchMm / 1000), p.chase_m_uzs.drain_50)
  }
  return total
}
