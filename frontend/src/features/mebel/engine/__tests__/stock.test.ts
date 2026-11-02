import { describe, it, expect } from 'vitest'
import { computeProject, EMPTY_PRICE_BOOK, nestSheets } from '../index'
import { producedOffcuts, usedStockIds } from '../offcuts'
import { newProject } from '../model'
import type { CutGroup, FurnitureProject, StockPiece } from '../model'

const stock = (o: Partial<StockPiece> = {}): StockPiece => ({ id: 'o1', material: 'board', materialId: null, thickness: 18, length: 2000, width: 1200, ...o })
function fourCabinets(useOffcuts = true): FurnitureProject {
  const p = newProject('x')
  p.defaults.useOffcuts = useOffcuts
  p.cabinets = [0, 1, 2, 3].map(i => ({ ...p.cabinets[0], id: `c${i}`, label: `M${i + 1}`, position: { x: i * 600, z: 0 } }))
  return p
}
const run = (p: FurnitureProject, s: StockPiece[] = []) => computeProject(p, EMPTY_PRICE_BOOK, {}, s)
const whole = (r: ReturnType<typeof run>, m = 'board', t = 18) =>
  r.nesting.filter(n => n.material === m && n.thickness === t).flatMap(n => n.sheets).filter(s => !s.stockId).length

describe('offcut stock in the cutting layout', () => {
  it('a part that fits a stock piece goes there and whole sheets drop', () => {
    const before = whole(run(fourCabinets()))
    const r = run(fourCabinets(), [stock()])
    expect(whole(r)).toBeLessThan(before)
    const board = r.nesting.find(n => n.material === 'board' && n.thickness === 18)!
    expect(board.sheets[0]).toMatchObject({ stockId: 'o1', size: { length: 2000, width: 1200 } })
    expect(usedStockIds(r.nesting)).toEqual(['o1'])
  })

  it('stock of another material, materialId or thickness is ignored', () => {
    const r = run(fourCabinets(), [stock({ id: 'a', material: 'back', thickness: 4, length: 300, width: 300 }), stock({ id: 'b', materialId: 'x' }), stock({ id: 'c', thickness: 16 })])
    expect(r.nesting.flatMap(n => n.sheets).some(s => s.stockId)).toBe(false)
  })

  it('a stock piece too small for every part is not used', () => {
    const r = run(fourCabinets(), [stock({ length: 210, width: 210 })])
    expect(usedStockIds(r.nesting)).toEqual([])
  })

  it('stock bins have no trim: a part of exactly the bin size fits at the corner', () => {
    const g: CutGroup = {
      key: 'k', role: 'shelf', roles: ['shelf'], material: 'board', materialId: null, thickness: 18,
      cut: { length: 800, width: 600 }, finished: { length: 800, width: 600 }, grain: 'length',
      edges: { L1: null, L2: null, W1: null, W2: null }, qty: 1, partIds: ['P1'], names: [],
    }
    const [n] = nestSheets([g], { length: 2800, width: 2070 }, { kerf: 4, trim: 10 }, [stock({ length: 800, width: 600 })])
    expect(n.sheets).toHaveLength(1)
    expect(n.sheets[0].stockId).toBe('o1')
    expect(n.sheets[0].placements[0]).toMatchObject({ x: 0, y: 0, length: 800, width: 600 })
  })

  it('BOM: sheets count whole sheets only, cutting counts stock bins too', () => {
    const r = run(fourCabinets(), [stock()])
    const bins = r.nesting.flatMap(n => n.sheets).length
    expect(r.bom.find(b => b.label === 'board_18')!.qty).toBe(whole(r))
    expect(r.bom.find(b => b.label === 'cut')!.qty).toBe(bins)
  })

  it('useOffcuts off, or an empty store: layout as before', () => {
    const plain = run(fourCabinets(false))
    expect(run(fourCabinets(false), [stock()])).toEqual(plain)
    expect(run(fourCabinets(true), []).nesting).toEqual(run(fourCabinets(false)).nesting)
  })

  it('produced offcuts carry the bin material, materialId and thickness', () => {
    const r = run(fourCabinets(), [stock()])
    const made = producedOffcuts(r.nesting)
    expect(made.length).toBeGreaterThan(0)
    for (const o of made) {
      expect(o.length).toBeGreaterThanOrEqual(200)
      expect(o.width).toBeGreaterThanOrEqual(200)
      expect(r.nesting.some(n => n.material === o.material && n.thickness === o.thickness && n.materialId === o.materialId)).toBe(true)
    }
  })
})
