import { describe, it, expect, vi } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import { CutListTable } from './CutListTable'
import { baseCabinetParts, DEFAULTS, groupParts } from '@/features/mebel/engine'
import i18n from '@/i18n'
import { formatMm } from './format'

const cab = { id: 'c1', type: 'base' as const, label: 'M1', width: 600, height: 720, depth: 560, shelves: 1, position: { x: 0, z: 0 } }
const groups = groupParts(baseCabinetParts(cab, DEFAULTS))

describe('CutListTable', () => {
  it('one row per group, with ids, quantity and banding', () => {
    render(<CutListTable groups={groups} showCut selectedPartId={null} onSelect={() => {}} />)
    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1).filter((r) => !r.hasAttribute('data-group'))
    expect(rows).toHaveLength(groups.length)
    expect(rows[0]).toHaveTextContent('M1-01, M1-02')
    expect(rows[0]).toHaveTextContent(formatMm(719.6))
    expect(rows[0]).toHaveTextContent('2')
  })

  it('selects a part when its row is clicked and highlights the selected one', () => {
    const onSelect = vi.fn()
    const { rerender } = render(<CutListTable groups={groups} showCut selectedPartId={null} onSelect={onSelect} />)
    const bottomRow = screen.getByText(i18n.t('mebel.part.bottom')).closest('tr')!
    fireEvent.click(bottomRow)
    expect(onSelect).toHaveBeenCalledWith('M1-03')
    rerender(<CutListTable groups={groups} showCut selectedPartId="M1-03" onSelect={onSelect} />)
    expect(screen.getByText(i18n.t('mebel.part.bottom')).closest('tr')).toHaveAttribute('aria-selected', 'true')
  })
})

describe('CutListTable names', () => {
  it('names every role a row holds', () => {
    const d = { ...DEFAULTS, edge: { ...DEFAULTS.edge, visible: { ...DEFAULTS.edge.visible, thickness: 0 as const } } }
    render(<CutListTable groups={groupParts(baseCabinetParts(cab, d))} showCut selectedPartId={null} onSelect={() => {}} />)
    expect(screen.getByText(`${i18n.t('mebel.part.rail_front')}, ${i18n.t('mebel.part.rail_back')}`)).toBeInTheDocument()
  })

  const mixed = () => {
    const [a, b, c] = groups
    return [
      { ...a, key: 'a', material: 'board' as const, thickness: 18, qty: 2 },
      { ...b, key: 'b', material: 'back' as const, thickness: 4, qty: 1 },
      { ...c, key: 'c', material: 'board' as const, thickness: 18, qty: 3 },
    ]
  }

  it('groups rows under one header per material and thickness, with the piece count, in engine order', () => {
    render(<CutListTable groups={mixed()} showCut selectedPartId={null} onSelect={() => {}} materialName={(g) => (g.material === 'board' ? 'LDSP Oq' : 'HDF')} />)
    const headers = within(screen.getByRole('table')).getAllByRole('row').filter((r) => r.hasAttribute('data-group'))
    expect(headers.map((h) => h.textContent)).toEqual([
      `LDSP Oq · 18 mm · ${i18n.t('mebel.cut_group_qty', { n: 5 })}`,
      `HDF · 4 mm · ${i18n.t('mebel.cut_group_qty', { n: 1 })}`,
    ])
    const order = within(screen.getByRole('table')).getAllByRole('row').slice(1).map((r) => r.getAttribute('data-group') ?? r.getAttribute('data-key'))
    expect(order).toEqual(['board|18|', 'a', 'c', 'back|4|', 'b'])
  })

  it('on screen the material and thickness move to the header; print keeps them as columns and drops the headers', () => {
    render(<CutListTable groups={mixed()} showCut selectedPartId={null} onSelect={() => {}} />)
    const header = within(screen.getByRole('table')).getAllByRole('row').find((r) => r.hasAttribute('data-group'))!
    expect(header).toHaveClass('print:hidden')
    expect(screen.getAllByTestId('material-cell')[0].className).toMatch(/\bhidden\b/)
    expect(screen.getAllByTestId('material-cell')[0].className).toMatch(/print:table-cell/)
  })

  it('a flat table (print) keeps the engine order and has no headers', () => {
    render(<CutListTable groups={mixed()} showCut selectedPartId={null} onSelect={() => {}} grouped={false} />)
    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1)
    expect(rows.map((r) => r.getAttribute('data-key'))).toEqual(['a', 'b', 'c'])
  })

  it('the edges cell draws the four sides and names them for a screen reader', () => {
    const g = { ...groups[0], key: 'e', edges: { L1: { band: 'visible' as const, thickness: 2 }, L2: null, W1: { band: 'hidden' as const, thickness: 0.4 }, W2: null } }
    render(<CutListTable groups={[g]} showCut selectedPartId={null} onSelect={() => {}} />)
    const cell = screen.getByTestId('edges-cell')
    expect(cell.querySelector('svg')).not.toBeNull()
    expect(cell.querySelectorAll('line')).toHaveLength(4)
    expect(cell.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true')
    expect(within(cell).getByText(/L1 2 mm · L2 — · W1 0[.,]4 mm · W2 —/)).toHaveClass('sr-only')
    expect(cell.getAttribute('title')).toMatch(/L1 2 mm/)
  })
})
