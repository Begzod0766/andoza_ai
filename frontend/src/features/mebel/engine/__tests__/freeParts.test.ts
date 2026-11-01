import { describe, it, expect } from 'vitest'
import { computeProject, EMPTY_PRICE_BOOK, validateProject } from '../index'
import { freePartParts } from '../rules/freeParts'
import { newFreePart, newProject } from '../model'
import type { FreePartSpec, FurnitureProject } from '../model'
import { groupName } from '@/features/mebel/ui/format'

const free = (o: Partial<FreePartSpec> = {}): FreePartSpec => ({ ...newFreePart('D1'), id: 'f1', name: 'Stoleshnitsa', length: 2400, width: 600, ...o })
const withFree = (rows: FreePartSpec[], cabinets = true): FurnitureProject => {
  const p = newProject('x')
  if (!cabinets) p.cabinets = []
  p.freeParts = rows
  return p
}
const run = (p: FurnitureProject) => computeProject(p, EMPTY_PRICE_BOOK, {})
const codes = (ws: { code: string }[]) => ws.map(w => w.code)

describe('free parts', () => {
  it('qty 3 gives three parts D1-1..D1-3 with the entered finished size', () => {
    const parts = freePartParts(free({ qty: 3 }), newProject('x').defaults)
    expect(parts.map(p => p.id)).toEqual(['D1-1', 'D1-2', 'D1-3'])
    for (const p of parts) {
      expect(p).toMatchObject({ role: 'free', name: 'Stoleshnitsa', cabinetId: 'f1', finished: { length: 2400, width: 600 }, qty: 1 })
      expect(p.holes ?? []).toEqual([])
    }
  })

  it('cut size takes the bands off unless premilled', () => {
    const d = newProject('x').defaults
    const spec = free({ edges: { L1: 'visible', L2: null, W1: 'hidden', W2: null } })
    expect(freePartParts(spec, d)[0].cut).toEqual({ length: 2399.6, width: 598 })
    expect(freePartParts(spec, { ...d, edge: { ...d.edge, premilled: true } })[0].cut).toEqual({ length: 2400, width: 600 })
  })

  it('material picks thickness and materialId from the matching setting', () => {
    const d = newProject('x').defaults
    const set = { ...d, board: { ...d.board, materialId: 'b' }, back: { ...d.back, materialId: 'h' }, facade: { ...d.facade, kind: 'ldsp' as const, materialId: 'f', thickness: 18 as const } }
    expect(freePartParts(free({ material: 'board' }), set)[0]).toMatchObject({ material: 'board', thickness: 18, materialId: 'b' })
    expect(freePartParts(free({ material: 'back' }), set)[0]).toMatchObject({ material: 'back', thickness: 4, materialId: 'h' })
    expect(freePartParts(free({ material: 'facade' }), set)[0]).toMatchObject({ material: 'facade', thickness: 18, materialId: 'f' })
  })

  it('free parts reach groups, nesting, edge totals and the BOM', () => {
    const base = run(newProject('x'))
    const r = run(withFree([free({ edges: { L1: 'visible', L2: null, W1: null, W2: null } })]))
    expect(r.errors).toEqual([])
    expect(r.groups.some(g => g.role === 'free')).toBe(true)
    const sheets = (x: typeof r) => x.nesting.filter(n => n.material === 'board').reduce((s, n) => s + n.sheets.length, 0)
    expect(sheets(r)).toBeGreaterThanOrEqual(sheets(base))
    expect(r.nesting.flatMap(n => n.sheets.flatMap(s => s.placements.map(pl => pl.partId)))).toContain('D1-1')
    const metres = (x: typeof r) => x.edgeTotals.reduce((s, e) => s + e.meters, 0)
    expect(metres(r)).toBeGreaterThan(metres(base))
  })

  it('a project with only free parts computes', () => {
    const r = run(withFree([free()], false))
    expect(r.errors).toEqual([])
    expect(r.parts.map(p => p.id)).toEqual(['D1-1'])
  })

  it('a free part bigger than the sheet is unplaced, the rest computes', () => {
    const r = run(withFree([free({ length: 3000, width: 2100 })]))
    expect(r.errors).toEqual([])
    expect(r.nesting.flatMap(n => n.unplaced)).toContain('D1-1')
  })

  it('validation', () => {
    const err = (o: Partial<FreePartSpec>) => validateProject(withFree([free(o)])).errors
    for (const o of [{ length: 5 }, { length: 3001 }, { width: 600.5 }]) expect(codes(err(o))).toContain('free_size')
    for (const o of [{ qty: 0 }, { qty: 101 }, { qty: 1.5 }]) expect(codes(err(o))).toContain('free_qty')
    expect(codes(err({ name: '  ' }))).toContain('free_name')
    expect(err({ length: 5 }).find(e => e.code === 'free_size')?.cabinetId).toBe('f1')
    const many = Array.from({ length: 101 }, (_, i) => free({ id: `f${i}`, label: `D${i + 1}` }))
    expect(codes(validateProject(withFree(many)).errors)).toContain('too_many_free')
    expect(codes(validateProject(withFree([], false)).errors)).toContain('empty_project')
  })

  it('an old project without freeParts computes as before', () => {
    const p = newProject('x')
    const before = run(p).parts.map(x => x.id)
    delete (p as Partial<FurnitureProject>).freeParts
    expect(run(p).parts.map(x => x.id)).toEqual(before)
  })

  it('the cut list names free parts by their own names', () => {
    const r = run(withFree([free({ id: 'a', label: 'D1', name: 'A', length: 500, width: 300 }), free({ id: 'b', label: 'D2', name: 'B', length: 500, width: 300 })], false))
    const g = r.groups.find(x => x.role === 'free')!
    expect(g.qty).toBe(2)
    expect(groupName(g)).toBe('A, B')
  })

  it('a door-LDSP free part is cut from the board when the doors are not LDSP', () => {
    for (const kind of ['mdf', 'none'] as const) {
      const p = withFree([free({ material: 'facade' })])
      p.defaults.board.materialId = 'b'
      p.defaults.facade = { ...p.defaults.facade, kind, materialId: 'MDF1', thickness: 19 }
      const r = run(p)
      expect(r.parts.find(x => x.id === 'D1-1')).toMatchObject({ material: 'board', materialId: 'b', thickness: 18 })
      expect(r.bom.some(l => l.label === 'facade_19')).toBe(false)
    }
  })

  it('at most 1000 free pieces in all', () => {
    const rows = Array.from({ length: 11 }, (_, i) => free({ id: `f${i}`, label: `D${i + 1}`, qty: 100 }))
    expect(codes(validateProject(withFree(rows)).errors)).toContain('free_pieces')
    expect(codes(validateProject(withFree(rows.slice(0, 10))).errors)).not.toContain('free_pieces')
  })
})
