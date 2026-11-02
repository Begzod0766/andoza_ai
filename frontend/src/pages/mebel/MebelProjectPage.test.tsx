import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, fireEvent, act, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ConfirmProvider } from '@/components/ui/ConfirmDialog'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import MebelProjectPage from './MebelProjectPage'
import * as api from '@/lib/api'
import i18n from '@/i18n'
import { formatMm } from '@/features/mebel/ui/format'
import { EMPTY_PRICE_BOOK, newProject } from '@/features/mebel/engine'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof api>('@/lib/api')
  return {
    ...actual,
    getMebelProject: vi.fn(),
    saveMebelProject: vi.fn(),
    getPriceBook: vi.fn(),
    savePriceBook: vi.fn(),
    getMaterials: vi.fn(),
    getCatalogMaterials: vi.fn(),
    listOffcuts: vi.fn(),
    cutMebelProject: vi.fn(),
  }
})
vi.mock('@/features/mebel/export/csv', async () => {
  const actual = await vi.importActual<typeof import('@/features/mebel/export/csv')>('@/features/mebel/export/csv')
  return { ...actual, downloadCsv: vi.fn() }
})
// The 3D view needs WebGL; the page only has to hand it the parts.
vi.mock('@/features/mebel/three/CabinetView', () => ({
  CabinetView: ({ parts }: { parts: unknown[] }) => <div data-testid="cabinet-view" data-parts={parts.length} />,
}))

const t = (k: string, o?: Record<string, unknown>) => i18n.t(k, o)

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ConfirmProvider>
      <MemoryRouter initialEntries={['/mebel/p1']}>
        <Routes>
          <Route path="/mebel/:id" element={<MebelProjectPage />} />
        </Routes>
      </MemoryRouter>
      </ConfirmProvider>
    </QueryClientProvider>,
  )
}

/** Runs one entry of the header's export menu. */
async function exportItem(name: string) {
  fireEvent.click(await screen.findByRole('button', { name: t('mebel.header.export') }))
  fireEvent.click(screen.getByRole('menuitem', { name }))
}

const partsTable = () => screen.getByRole('table', { name: t('mebel.tab.parts') })
const rowOf = (name: string) => within(partsTable()).getAllByRole('row').find(r => r.textContent?.includes(name))!

beforeEach(() => {
  vi.clearAllMocks()
  const project = newProject('Oshxona')
  project.cabinets[0].id = 'c1'
  vi.mocked(api.getMebelProject).mockResolvedValue({ id: 'p1', name: 'Oshxona', data: project })
  vi.mocked(api.saveMebelProject).mockResolvedValue({ id: 'p1', name: 'Oshxona', data: project })
  vi.mocked(api.getPriceBook).mockResolvedValue(EMPTY_PRICE_BOOK)
  vi.mocked(api.getMaterials).mockResolvedValue([])
  vi.mocked(api.getCatalogMaterials).mockResolvedValue([])
  vi.mocked(api.listOffcuts).mockResolvedValue([])
})
afterEach(() => vi.useRealTimers())

describe('MebelProjectPage', () => {
  it('shows the cut list of the saved project', async () => {
    mount()
    await screen.findByRole('table', { name: t('mebel.tab.parts') })
    const side = rowOf(t('mebel.part.side_left'))
    expect(side).toHaveTextContent(formatMm(719.6))
    expect(side).toHaveTextContent('554')
    expect(screen.getByTestId('cabinet-view')).toHaveAttribute('data-parts', '8')
  })

  it('recomputes the parts when a size changes', async () => {
    mount()
    const width = await screen.findByLabelText(t('mebel.width'))
    fireEvent.change(width, { target: { value: '800' } })
    const bottom = rowOf(t('mebel.part.bottom'))
    expect(bottom).toHaveTextContent('764')
    expect(bottom).toHaveTextContent('554')
  })

  it('switches between cut and finished sizes', async () => {
    mount()
    await screen.findByRole('table', { name: t('mebel.tab.parts') })
    fireEvent.click(screen.getByRole('button', { name: t('mebel.show_finished') }))
    const side = rowOf(t('mebel.part.side_left'))
    expect(side).toHaveTextContent('720')
    expect(side).toHaveTextContent('556')
  })

  it('an out-of-range size shows the error and no parts', async () => {
    mount()
    const width = await screen.findByLabelText(t('mebel.width'))
    fireEvent.change(width, { target: { value: '100' } })
    expect(screen.getByText(t('mebel.error.width_range', { min: 150, max: 1200 }))).toBeInTheDocument()
    expect(screen.queryByRole('table', { name: t('mebel.tab.parts') })).not.toBeInTheDocument()
    expect(width).toHaveAttribute('aria-invalid', 'true')
  })

  it('saves once, a second after the last change', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    mount()
    const width = await screen.findByLabelText(t('mebel.width'))
    fireEvent.change(width, { target: { value: '700' } })
    fireEvent.change(width, { target: { value: '800' } })
    await act(async () => { vi.advanceTimersByTime(500) })
    expect(api.saveMebelProject).not.toHaveBeenCalled()
    await act(async () => { vi.advanceTimersByTime(1100) })
    expect(api.saveMebelProject).toHaveBeenCalledTimes(1)
    const [, , data] = vi.mocked(api.saveMebelProject).mock.calls[0]
    expect(data.cabinets[0].width).toBe(800)
  })

  it('marks lines without a price as unpriced', async () => {
    mount()
    await screen.findByRole('table', { name: t('mebel.tab.parts') })
    fireEvent.click(screen.getByRole('tab', { name: t('mebel.tab.bom') }))
    expect(screen.getAllByText(t('mebel.unpriced')).length).toBeGreaterThan(0)
  })

  it('adds a cabinet next to the last one', async () => {
    mount()
    fireEvent.click(await screen.findByRole('button', { name: t('mebel.add.base') }))
    expect(screen.getByTestId('cabinet-view')).toHaveAttribute('data-parts', '16')
    expect(screen.getByText('M2')).toBeInTheDocument()
  })

  it('removing a cabinet asks first; cancel keeps it', async () => {
    mount()
    fireEvent.click(await screen.findByRole('button', { name: t('mebel.add.base') }))
    const removeM2 = () => screen.getAllByRole('button', { name: t('mebel.remove') })[1]
    fireEvent.click(removeM2())
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(t('mebel.remove_confirm', { label: 'M2' }))).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: t('common.bekor') }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.getByText('M2')).toBeInTheDocument()

    fireEvent.click(removeM2())
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: t('mebel.remove') }))
    await waitFor(() => expect(screen.queryByText('M2')).toBeNull())
  })
})

describe('MebelProjectPage export', () => {
  it('downloads the cut list as CSV named after the project', async () => {
    const csv = await import('@/features/mebel/export/csv')
    const spy = vi.mocked(csv.downloadCsv)
    mount()
    await exportItem(t('mebel.export_csv'))
    expect(spy).toHaveBeenCalledTimes(1)
    const [name, body] = spy.mock.calls[0]
    expect(name).toBe('Oshxona')
    expect(body).toContain('ID;Detal;Material')
    expect(body).toContain(t('mebel.part.side_left'))
  })

  it('PDF opens the print dialog with the printable cut list', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})
    mount()
    await exportItem(t('mebel.export_pdf'))
    await act(async () => { await new Promise(r => setTimeout(r, 20)) })
    expect(print).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('mebel-print')).toHaveTextContent(t('mebel.print_title', { name: 'Oshxona' }))
  })
})

describe('MebelProjectPage review fixes', () => {
  it('the price book dialog shows the saved prices even when they arrive after the page', async () => {
    let resolvePb: (pb: typeof EMPTY_PRICE_BOOK) => void = () => {}
    vi.mocked(api.getPriceBook).mockReturnValue(new Promise(r => { resolvePb = r }))
    mount()
    await screen.findByRole('table', { name: t('mebel.tab.parts') })
    await act(async () => { resolvePb({ ...EMPTY_PRICE_BOOK, cutPerSheet: 40000, markupPercent: 30 }) })
    fireEvent.click(screen.getByRole('button', { name: t('mebel.price_book') }))
    expect(await screen.findByDisplayValue('40000')).toBeInTheDocument()
    expect(screen.getByDisplayValue('30')).toBeInTheDocument()
  })

  it('reopening the dialog after Cancel shows the saved prices, not the cancelled edit', async () => {
    vi.mocked(api.getPriceBook).mockResolvedValue({ ...EMPTY_PRICE_BOOK, cutPerSheet: 40000 })
    mount()
    await screen.findByRole('table', { name: t('mebel.tab.parts') })
    fireEvent.click(screen.getByRole('button', { name: t('mebel.price_book') }))
    fireEvent.change(await screen.findByDisplayValue('40000'), { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: t('mebel.cancel') }))
    fireEvent.click(screen.getByRole('button', { name: t('mebel.price_book') }))
    expect(await screen.findByDisplayValue('40000')).toBeInTheDocument()
  })

  it('leaving the page saves the pending edit at once', async () => {
    const view = mount()
    fireEvent.change(await screen.findByLabelText(t('mebel.width')), { target: { value: '900' } })
    view.unmount()
    expect(api.saveMebelProject).toHaveBeenCalledTimes(1)
    expect(vi.mocked(api.saveMebelProject).mock.calls[0][2].cabinets[0].width).toBe(900)
  })

  it('an edit that does not validate says it is not saved', async () => {
    mount()
    fireEvent.change(await screen.findByLabelText(t('mebel.width')), { target: { value: '100' } })
    expect(screen.getByRole('status')).toHaveTextContent(t('mebel.not_saved_invalid'))
  })
})

describe('MebelProjectPage save status', () => {
  it('says saved only when the latest save has landed', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const done: Array<() => void> = []
    vi.mocked(api.saveMebelProject).mockImplementation(() => new Promise(r => done.push(() => r({} as never))))
    mount()
    const width = await screen.findByLabelText(t('mebel.width'))
    fireEvent.change(width, { target: { value: '700' } })
    await act(async () => { vi.advanceTimersByTime(1100) })
    fireEvent.change(width, { target: { value: '800' } })
    await act(async () => { vi.advanceTimersByTime(1100) })
    expect(done).toHaveLength(2)
    await act(async () => { done[0]() })
    expect(screen.getByRole('status')).toHaveTextContent(t('mebel.saving'))
    await act(async () => { done[1]() })
    expect(screen.getByRole('status')).toHaveTextContent(t('mebel.saved'))
  })
})

describe('MebelProjectPage nesting', () => {
  it('the cutting layout tab draws the sheets', async () => {
    mount()
    await screen.findByRole('table', { name: t('mebel.tab.parts') })
    fireEvent.click(screen.getByRole('tab', { name: t('mebel.tab.nesting') }))
    expect(screen.getAllByRole('img').length).toBeGreaterThan(0)
  })

  it('kerf and trim are project settings', async () => {
    mount()
    const kerf = await screen.findByLabelText(t('mebel.kerf'))
    expect(kerf).toHaveValue(4)
    expect(screen.getByLabelText(t('mebel.trim'))).toHaveValue(10)
    fireEvent.change(kerf, { target: { value: '6' } })
    expect(screen.getByRole('status')).not.toHaveTextContent(t('mebel.not_saved_invalid'))
  })

  it('the BOM no longer calls the sheet count an estimate', async () => {
    mount()
    await screen.findByRole('table', { name: t('mebel.tab.parts') })
    fireEvent.click(screen.getByRole('tab', { name: t('mebel.tab.bom') }))
    expect(screen.queryByText(/≈/)).not.toBeInTheDocument()
  })
})

describe('MebelProjectPage cabinet types and doors', () => {
  it('adds a wall cabinet with its own size', async () => {
    mount()
    fireEvent.click(await screen.findByRole('button', { name: t('mebel.add.wall') }))
    const depths = screen.getAllByLabelText(t('mebel.depth')) as HTMLInputElement[]
    expect(depths.map(d => d.value)).toEqual(['560', '300'])
    expect(screen.getByText('M2')).toBeInTheDocument()
  })

  it('no doors: the cut list has no door', async () => {
    mount()
    await screen.findByRole('table', { name: t('mebel.tab.parts') })
    expect(rowOf(t('mebel.part.door'))).toBeDefined()
    fireEvent.change(screen.getByLabelText(t('mebel.doors')), { target: { value: '0' } })
    expect(rowOf(t('mebel.part.door'))).toBeUndefined()
  })

  it('MDF doors make an order with its own CSV', async () => {
    mount()
    fireEvent.change(await screen.findByLabelText(t('mebel.facade_kind')), { target: { value: 'mdf' } })
    fireEvent.click(screen.getByRole('tab', { name: t('mebel.tab.bom') }))
    expect(screen.getByRole('table', { name: t('mebel.facade_order') })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: t('mebel.export_facade_csv') })).toBeInTheDocument()
  })

  it('a tall cabinet 720 high is a height error', async () => {
    mount()
    fireEvent.click(await screen.findByRole('button', { name: t('mebel.add.tall') }))
    const heights = screen.getAllByLabelText(t('mebel.height'))
    fireEvent.change(heights[1], { target: { value: '720' } })
    expect(screen.getByText(t('mebel.error.height_range', { min: 1200, max: 2400 }))).toBeInTheDocument()
  })
})

describe('MebelProjectPage old saved project', () => {
  it('a project saved before doors and types opens, with no doors', async () => {
    const old = newProject('Eski')
    old.cabinets[0].id = 'c1'
    delete (old.defaults as Partial<typeof old.defaults>).facade
    delete (old.cabinets[0] as Partial<typeof old.cabinets[0]>).type
    vi.mocked(api.getMebelProject).mockResolvedValue({ id: 'p1', name: 'Eski', data: old })
    mount()
    await screen.findByRole('table', { name: t('mebel.tab.parts') })
    expect(screen.getByLabelText(t('mebel.facade_kind'))).toHaveValue('none')
    expect(rowOf(t('mebel.part.door'))).toBeUndefined()
    fireEvent.change(screen.getByLabelText(t('mebel.facade_kind')), { target: { value: 'ldsp' } })
    expect(rowOf(t('mebel.part.door'))).toBeDefined()
    expect(screen.getByRole('status')).not.toHaveTextContent(t('mebel.not_saved_invalid'))
  })

  it('doors saved as null show as auto', async () => {
    const p = newProject('x')
    p.cabinets[0].id = 'c1'
    ;(p.cabinets[0] as { doors: unknown }).doors = null
    vi.mocked(api.getMebelProject).mockResolvedValue({ id: 'p1', name: 'x', data: p })
    mount()
    expect(await screen.findByLabelText(t('mebel.doors'))).toHaveValue('auto')
  })
})

describe('MebelProjectPage drawers', () => {
  it('three drawers: drawer parts, no door, shelves off', async () => {
    mount()
    fireEvent.change(await screen.findByLabelText(t('mebel.drawers')), { target: { value: '3' } })
    expect(rowOf(t('mebel.part.drawer_side'))).toBeDefined()
    // no row is named "door" (the drawer fronts' material column also says "Fasad")
    expect(within(partsTable()).queryByRole('cell', { name: t('mebel.part.door') })).toBeNull()
    expect(screen.getByLabelText(t('mebel.shelves'))).toBeDisabled()
    expect(screen.getByLabelText(t('mebel.doors'))).toBeDisabled()
  })
})

describe('MebelProjectPage drawer fixes', () => {
  it('a drawer error is shown on the drawers field', async () => {
    mount()
    fireEvent.change(await screen.findByLabelText(t('mebel.height')), { target: { value: '300' } })
    fireEvent.change(screen.getByLabelText(t('mebel.drawers')), { target: { value: '4' } })
    expect(screen.getByText(t('mebel.error.drawer_low', { min: 80 }))).toBeInTheDocument()
    expect(screen.getByLabelText(t('mebel.drawers'))).toHaveAttribute('aria-invalid', 'true')
  })

  it('the price book takes a price for a pair of slides', async () => {
    vi.mocked(api.savePriceBook).mockImplementation(async (pb) => pb)
    mount()
    await screen.findByRole('table', { name: t('mebel.tab.parts') })
    fireEvent.click(screen.getByRole('button', { name: t('mebel.price_book') }))
    fireEvent.change(await screen.findByLabelText(t('mebel.pb.slide')), { target: { value: '45000' } })
    fireEvent.click(screen.getByRole('button', { name: t('mebel.save') }))
    await act(async () => {})
    expect(vi.mocked(api.savePriceBook).mock.calls[0][0].hardware.slide).toBe(45000)
  })

  it('the price book takes LDSP, HDF and MDF prices, and the sheets use them', async () => {
    vi.mocked(api.savePriceBook).mockImplementation(async (pb) => pb)
    mount()
    await screen.findByRole('table', { name: t('mebel.tab.parts') })
    fireEvent.click(screen.getByRole('button', { name: t('mebel.price_book') }))
    fireEvent.change(await screen.findByLabelText(t('mebel.pb.board', { t: 18 })), { target: { value: '556000' } })
    fireEvent.change(screen.getByLabelText(t('mebel.pb.board', { t: 16 })), { target: { value: '480000' } })
    fireEvent.change(screen.getByLabelText(t('mebel.pb.back')), { target: { value: '120000' } })
    fireEvent.change(screen.getByLabelText(t('mebel.pb.mdf_m2')), { target: { value: '350000' } })
    fireEvent.click(screen.getByRole('button', { name: t('mebel.save') }))
    await act(async () => {})
    expect(vi.mocked(api.savePriceBook).mock.calls[0][0].sheets).toEqual({ board16: 480000, board18: 556000, back: 120000, mdfM2: 350000 })
  })

  it('on a phone, one switch shows the settings or the result, not one long page', async () => {
    mount()
    await screen.findByRole('table', { name: t('mebel.tab.parts') })
    const settings = screen.getByRole('button', { name: t('mebel.pane.params') })
    const result = screen.getByRole('button', { name: t('mebel.pane.result') })
    const aside = screen.getByTestId('mebel-params')
    const main = screen.getByTestId('mebel-result')
    // the settings first; on a wide screen both stay (lg:)
    expect(settings).toHaveAttribute('aria-pressed', 'true')
    expect(main.className).toMatch(/(^| )hidden( |$)/)
    expect(main.className).toContain('lg:flex')
    fireEvent.click(result)
    expect(result).toHaveAttribute('aria-pressed', 'true')
    expect(aside.className).toMatch(/(^| )hidden( |$)/)
    expect(aside.className).toContain('lg:block')
    expect(main.className).not.toMatch(/(^| )hidden( |$)/)
  })

  it('a long material name is cut short on screen, whole on hover and in print', async () => {
    mount()
    const cell = within(await screen.findByRole('table', { name: t('mebel.tab.parts') })).getAllByTestId('material-cell')[0]
    expect(cell.className).toContain('truncate')
    expect(cell.className).toContain('print:whitespace-normal')
    expect(cell).toHaveAttribute('title', cell.textContent)
  })

  it('on a phone the cut list keeps the sizes: id, material and grain columns hide below sm', async () => {
    mount()
    const table = await screen.findByRole('table', { name: t('mebel.tab.parts') })
    const header = (name: string) => within(table).getByRole('columnheader', { name })
    for (const name of [t('mebel.col.id'), t('mebel.col.grain')]) {
      expect(header(name).className).toContain('hidden sm:table-cell print:table-cell')
    }
    // the material and thickness sit in each group's header row on screen, and print as columns
    expect(header(t('mebel.col.material')).className).toContain('hidden print:table-cell')
    for (const name of [t('mebel.col.part'), t('mebel.col.length'), t('mebel.col.width'), t('mebel.col.qty')]) {
      expect(header(name).className).not.toContain('hidden')
    }
    // and the table itself does not hold a desktop width
    expect(table.className).not.toMatch(/(^| )min-w-/)
  })

  it('each cabinet has its place along the wall, and Re-arrange lays them out again', async () => {
    mount()
    await screen.findByRole('table', { name: t('mebel.tab.parts') })
    fireEvent.click(screen.getByRole('button', { name: t('mebel.add.base') }))
    const x2 = () => screen.getAllByLabelText(t('mebel.position_x'))[1] as HTMLInputElement
    expect(x2().value).toBe('600')
    fireEvent.change(x2(), { target: { value: '900' } })
    expect(x2().value).toBe('900')
    fireEvent.change(x2(), { target: { value: '-5' } })
    expect(screen.getByText(t('mebel.error.position_range'))).toBeInTheDocument()
    fireEvent.change(x2(), { target: { value: '900' } })
    // a gap after M1: re-arranging closes it
    fireEvent.click(screen.getByRole('button', { name: t('mebel.relayout') }))
    expect(x2().value).toBe('600')
  })

  it('on a phone the thickness column gives way too', async () => {
    mount()
    const table = await screen.findByRole('table', { name: t('mebel.tab.parts') })
    expect(within(table).getByRole('columnheader', { name: t('mebel.col.thickness') }).className).toContain('hidden print:table-cell')
  })

})

describe('MebelProjectPage layout', () => {
  const rowOfCab = (label: string) => screen.getByTestId(`cabinet-${label}`) as HTMLDetailsElement

  it('cabinets are one-line rows; one opens at a time', async () => {
    mount()
    await screen.findByRole('table', { name: t('mebel.tab.parts') })
    fireEvent.click(screen.getByRole('button', { name: t('mebel.add.wall') }))
    // the new cabinet opens, the first one closes
    expect(rowOfCab('M2').open).toBe(true)
    expect(rowOfCab('M1').open).toBe(false)
    expect(within(rowOfCab('M2')).getByText(/600×720×300/)).toBeInTheDocument()
    fireEvent.click(within(rowOfCab('M1')).getByText('M1'))
    expect(rowOfCab('M1').open).toBe(true)
    expect(rowOfCab('M2').open).toBe(false)
  })

  it('a cabinet with an error stays open and is marked', async () => {
    mount()
    await screen.findByRole('table', { name: t('mebel.tab.parts') })
    fireEvent.click(screen.getByRole('button', { name: t('mebel.add.base') }))
    fireEvent.change(screen.getAllByLabelText(t('mebel.width'))[0], { target: { value: '50' } })
    expect(rowOfCab('M1').open).toBe(true)
    expect(within(rowOfCab('M1')).getByTestId('cabinet-error-dot')).toBeInTheDocument()
  })

  it('settings, doors and the AI box start folded', async () => {
    mount()
    await screen.findByRole('table', { name: t('mebel.tab.parts') })
    expect((screen.getByTestId('section-settings') as HTMLDetailsElement).open).toBe(false)
    expect((screen.getByTestId('section-facade') as HTMLDetailsElement).open).toBe(false)
    expect((screen.getByTestId('section-ai') as HTMLDetailsElement).open).toBe(false)
  })

  it('the 3D view can be hidden to give the tables the room', async () => {
    mount()
    await screen.findByRole('table', { name: t('mebel.tab.parts') })
    // the button sits on the view itself, leaving the tabs the whole row
    const hide = screen.getByRole('button', { name: t('mebel.view_hide') })
    expect(hide.closest('[aria-label="' + t('mebel.view3d') + '"]')).not.toBeNull()
    expect(within(screen.getByRole('tablist').parentElement!).queryByRole('button', { name: t('mebel.view_hide') })).toBeNull()
    fireEvent.click(hide)
    expect(screen.queryByTestId('cabinet-view')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: t('mebel.view_show') }))
    expect(screen.getByTestId('cabinet-view')).toBeInTheDocument()
  })

  it('selecting a part opens its cabinet', async () => {
    mount()
    await screen.findByRole('table', { name: t('mebel.tab.parts') })
    fireEvent.click(screen.getByRole('button', { name: t('mebel.add.wall') }))
    expect(rowOfCab('M1').open).toBe(false)
    fireEvent.click(rowOf(i18n.t('mebel.part.bottom')))
    expect(rowOfCab('M1').open).toBe(true)
  })

})

describe('MebelProjectPage labels', () => {
  it('Yorliqlar prints the A4 sticker sheet, not the PDF', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})
    mount()
    await screen.findByRole('table', { name: t('mebel.tab.parts') })
    await exportItem(t('mebel.labels.a4'))
    expect(print).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('mebel-labels')).toBeInTheDocument()
    expect(screen.queryByTestId('mebel-print')).toBeNull()
    expect(screen.getAllByTestId('label').length).toBeGreaterThan(5)
    print.mockRestore()
  })

  it('a link with ?part= opens that part on the drilling tab', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <ConfirmProvider>
        <MemoryRouter initialEntries={['/mebel/p1?part=M1-02']}>
          <Routes>
            <Route path="/mebel/:id" element={<MebelProjectPage />} />
          </Routes>
        </MemoryRouter>
        </ConfirmProvider>
      </QueryClientProvider>,
    )
    expect(await screen.findByRole('tab', { name: t('mebel.tab.drilling'), selected: true })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: `M1-02 — ${t('mebel.drill.holes')}` })).toBeInTheDocument()
  })

})

describe('MebelProjectPage free parts', () => {
  const addFree = () => fireEvent.click(screen.getByRole('button', { name: t('mebel.free.add') }))
  const field = (label: string) => within(screen.getByTestId('free-D1')).getByLabelText(label) as HTMLInputElement

  it('+ Detal adds D1, editable, and it shows in the cut list', async () => {
    mount()
    await screen.findByRole('table', { name: t('mebel.tab.parts') })
    addFree()
    fireEvent.change(field(t('mebel.free.name')), { target: { value: 'Sokol' } })
    fireEvent.change(field(t('mebel.free.length')), { target: { value: '2400' } })
    fireEvent.change(field(t('mebel.free.width')), { target: { value: '100' } })
    fireEvent.change(field(t('mebel.free.qty')), { target: { value: '2' } })
    const row = within(partsTable()).getAllByRole('row').find(r => r.textContent?.includes('Sokol'))!
    expect(row).toBeTruthy()
    expect(row.textContent).toContain('2400')
  })

  it('band buttons cycle none → visible → hidden', async () => {
    mount()
    await screen.findByRole('table', { name: t('mebel.tab.parts') })
    addFree()
    const l1 = within(screen.getByTestId('free-D1')).getByRole('button', { name: /^L1/ })
    expect(l1.textContent).toContain('—')
    fireEvent.click(l1)
    expect(l1.textContent).toContain('2')
    fireEvent.click(l1)
    expect(l1.textContent).toContain('0.4')
    fireEvent.click(l1)
    expect(l1.textContent).toContain('—')
  })

  it('a free-part error marks its field and row', async () => {
    mount()
    await screen.findByRole('table', { name: t('mebel.tab.parts') })
    addFree()
    fireEvent.change(field(t('mebel.free.length')), { target: { value: '5' } })
    expect(within(screen.getByTestId('free-D1')).getByText(t('mebel.error.free_size', { min: 10, max: 3000 }))).toBeInTheDocument()
    expect(within(screen.getByTestId('free-D1')).getByTestId('free-error-dot')).toBeInTheDocument()
  })

  it('the last cabinet can go once a free part exists', async () => {
    mount()
    await screen.findByRole('table', { name: t('mebel.tab.parts') })
    const removeCabinet = () => within(screen.getByTestId('cabinet-M1')).queryByRole('button', { name: t('mebel.remove') })
    expect(removeCabinet()).toBeNull()
    addFree()
    fireEvent.click(removeCabinet()!)
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: t('mebel.remove') }))
    await waitFor(() => expect(screen.queryByTestId('cabinet-M1')).toBeNull())
    expect(screen.getByRole('table', { name: t('mebel.tab.parts') })).toBeInTheDocument()
  })

  it('removing a free part asks first', async () => {
    mount()
    await screen.findByRole('table', { name: t('mebel.tab.parts') })
    addFree()
    fireEvent.click(within(screen.getByTestId('free-D1')).getByRole('button', { name: t('mebel.remove') }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(t('mebel.free.remove_confirm', { label: 'D1' }))).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: t('common.bekor') }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.getByTestId('free-D1')).toBeInTheDocument()
  })

  it('the only part of a project with no cabinet cannot be removed', async () => {
    mount()
    await screen.findByRole('table', { name: t('mebel.tab.parts') })
    addFree()
    fireEvent.click(within(screen.getByTestId('cabinet-M1')).getByRole('button', { name: t('mebel.remove') }))
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: t('mebel.remove') }))
    await waitFor(() => expect(screen.queryByTestId('cabinet-M1')).toBeNull())
    expect(within(screen.getByTestId('free-D1')).queryByRole('button', { name: t('mebel.remove') })).toBeNull()
  })

  it('a bad width marks the width field, and the top box does not repeat it', async () => {
    mount()
    await screen.findByRole('table', { name: t('mebel.tab.parts') })
    addFree()
    fireEvent.change(field(t('mebel.free.width')), { target: { value: '5' } })
    expect(field(t('mebel.free.width'))).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getAllByText(t('mebel.error.free_size', { min: 10, max: 3000 })).length).toBeLessThanOrEqual(2)
    const box = screen.getByText(t('mebel.errors_title')).parentElement!
    expect(within(box).queryByText(t('mebel.error.free_size', { min: 10, max: 3000 }))).toBeNull()
  })
})

describe('MebelProjectPage free part links', () => {
  it('a free part label names D1, and its QR opens the cut list, not another part\'s drilling map', async () => {
    const p = newProject('Oshxona')
    p.freeParts = [{ id: 'f1', label: 'D1', name: 'Stoleshnitsa', length: 2400, width: 600, qty: 1, material: 'board', grain: 'length', edges: { L1: null, L2: null, W1: null, W2: null } }]
    vi.mocked(api.getMebelProject).mockResolvedValue({ id: 'p1', name: 'Oshxona', data: p } as never)
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <ConfirmProvider>
        <MemoryRouter initialEntries={['/mebel/p1?part=D1-1']}>
          <Routes>
            <Route path="/mebel/:id" element={<MebelProjectPage />} />
          </Routes>
        </MemoryRouter>
        </ConfirmProvider>
      </QueryClientProvider>,
    )
    expect(await screen.findByRole('tab', { name: t('mebel.tab.parts'), selected: true })).toBeInTheDocument()
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})
    await exportItem(t('mebel.labels.a4'))
    const label = screen.getAllByTestId('label').find(l => l.textContent?.includes('D1-1'))!
    expect(label.textContent).toContain('D1 · Oshxona')
    print.mockRestore()
  })
})

describe('MebelProjectPage offcut stock', () => {
  const STOCK = [{ id: 'o1', material: 'board' as const, materialId: null, thickness: 18, length: 2000, width: 1200, source_project_id: null, created_at: '2026-11-01T10:00:00Z' }]
  const useStock = async () => {
    vi.mocked(api.listOffcuts).mockResolvedValue(STOCK)
    mount()
    await screen.findByRole('table', { name: t('mebel.tab.parts') })
    fireEvent.click(await screen.findByLabelText(t('mebel.offcuts.use', { n: 1 })))
  }

  it('the checkbox uses the store: a sheet becomes "Qoldiq · 2000×1200"', async () => {
    await useStock()
    fireEvent.click(screen.getByRole('tab', { name: t('mebel.tab.nesting') }))
    expect(screen.getAllByText(t('mebel.offcuts.bin', { l: 2000, w: 1200 }), { exact: false }).length).toBeGreaterThan(0)
  })

  it('Kesildi sends the used and produced offcuts, then shows the date', async () => {
    vi.mocked(api.cutMebelProject).mockImplementation(async (id) => ({ id, name: 'Oshxona', data: newProject('Oshxona'), cut_at: '2026-11-02T10:00:00Z' }))
    await useStock()
    fireEvent.click(screen.getByRole('button', { name: t('mebel.offcuts.cut') }))
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: t('mebel.offcuts.cut') }))
    await waitFor(() => expect(api.cutMebelProject).toHaveBeenCalled())
    const [id, body] = vi.mocked(api.cutMebelProject).mock.calls[0]
    expect(id).toBe('p1')
    expect(body.used).toEqual(['o1'])
    expect(body.produced.every(o => o.length >= 200 && o.width >= 200)).toBe(true)
    expect(await screen.findByTestId('cut-at')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: t('mebel.offcuts.cut') })).toBeNull()
  })

  it('a 409 on Kesildi shows its message and refetches the store', async () => {
    vi.mocked(api.cutMebelProject).mockRejectedValue(new Error(JSON.stringify({ detail: "Qoldiqlar o'zgargan — raskroyni yangilang" })))
    await useStock()
    const calls = vi.mocked(api.listOffcuts).mock.calls.length
    fireEvent.click(screen.getByRole('button', { name: t('mebel.offcuts.cut') }))
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: t('mebel.offcuts.cut') }))
    expect(await screen.findByText("Qoldiqlar o'zgargan — raskroyni yangilang")).toBeInTheDocument()
    await waitFor(() => expect(vi.mocked(api.listOffcuts).mock.calls.length).toBeGreaterThan(calls))
  })

  it('Kesildi is disabled while the layout has errors', async () => {
    mount()
    await screen.findByRole('table', { name: t('mebel.tab.parts') })
    fireEvent.change(screen.getAllByLabelText(t('mebel.width'))[0], { target: { value: '50' } })
    expect(screen.getByRole('button', { name: t('mebel.offcuts.cut') })).toBeDisabled()
  })

  it('a cut project lays out without the store, so it shows what was sawn', async () => {
    const project = newProject('Oshxona'); project.defaults.useOffcuts = true
    vi.mocked(api.getMebelProject).mockResolvedValue({ id: 'p1', name: 'Oshxona', data: project, cut_at: '2026-11-02T10:00:00Z' })
    vi.mocked(api.listOffcuts).mockResolvedValue(STOCK)
    mount()
    await screen.findByTestId('cut-at')
    fireEvent.click(screen.getByRole('tab', { name: t('mebel.tab.nesting') }))
    expect(screen.queryByText(t('mebel.offcuts.bin', { l: 2000, w: 1200 }), { exact: false })).toBeNull()
  })

  it('Kesildi is disabled while a part fits no sheet', async () => {
    mount()
    await screen.findByRole('table', { name: t('mebel.tab.parts') })
    fireEvent.click(screen.getByRole('button', { name: t('mebel.free.add') }))
    fireEvent.change(within(screen.getByTestId('free-D1')).getByLabelText(t('mebel.free.length')), { target: { value: '3000' } })
    fireEvent.change(within(screen.getByTestId('free-D1')).getByLabelText(t('mebel.free.width')), { target: { value: '2500' } })
    expect(screen.getByRole('button', { name: t('mebel.offcuts.cut') })).toBeDisabled()
  })
})

describe('MebelProjectPage header and summary', () => {
  it('the title edits in place: Enter saves, Escape restores, an empty name is refused', async () => {
    mount()
    fireEvent.click(await screen.findByRole('button', { name: t('mebel.header.rename', { name: 'Oshxona' }) }))
    const field = screen.getByRole('textbox', { name: t('mebel.project_name') })
    fireEvent.change(field, { target: { value: 'Oshxona Chilonzor' } })
    fireEvent.keyDown(field, { key: 'Enter' })
    expect(screen.getByRole('heading', { name: 'Oshxona Chilonzor' })).toBeInTheDocument()
    await waitFor(() => expect(api.saveMebelProject).toHaveBeenLastCalledWith('p1', 'Oshxona Chilonzor', expect.anything()), { timeout: 3000 })

    fireEvent.click(screen.getByRole('button', { name: t('mebel.header.rename', { name: 'Oshxona Chilonzor' }) }))
    fireEvent.change(screen.getByRole('textbox', { name: t('mebel.project_name') }), { target: { value: 'Boshqa' } })
    fireEvent.keyDown(screen.getByRole('textbox', { name: t('mebel.project_name') }), { key: 'Escape' })
    expect(screen.getByRole('heading', { name: 'Oshxona Chilonzor' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: t('mebel.header.rename', { name: 'Oshxona Chilonzor' }) }))
    fireEvent.change(screen.getByRole('textbox', { name: t('mebel.project_name') }), { target: { value: '   ' } })
    fireEvent.keyDown(screen.getByRole('textbox', { name: t('mebel.project_name') }), { key: 'Enter' })
    expect(screen.getByRole('heading', { name: 'Oshxona Chilonzor' })).toBeInTheDocument()
  })

  it('the left panel no longer has a project-name field', async () => {
    mount()
    await screen.findByRole('table', { name: t('mebel.tab.parts') })
    expect(screen.queryByRole('textbox', { name: t('mebel.project_name') })).toBeNull()
  })

  it('the export menu holds PDF, the CSV and both label sheets', async () => {
    mount()
    fireEvent.click(await screen.findByRole('button', { name: t('mebel.header.export') }))
    expect(screen.getAllByRole('menuitem').map((i) => i.textContent)).toEqual([
      t('mebel.export_pdf'), t('mebel.export_csv'), t('mebel.labels.a4'), t('mebel.labels.roll'),
    ])
  })

  it('Kesildi asks first; cancel sends nothing and keeps the button', async () => {
    mount()
    await screen.findByRole('table', { name: t('mebel.tab.parts') })
    await waitFor(() => expect(screen.getByRole('button', { name: t('mebel.offcuts.cut') })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: t('mebel.offcuts.cut') }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent(t('mebel.header.cut_irreversible'))
    fireEvent.click(within(dialog).getByRole('button', { name: t('common.bekor') }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(api.cutMebelProject).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: t('mebel.offcuts.cut') })).toBeInTheDocument()
  })

  it('the summary bar shows sheets, banding, parts and price, and each part opens its tab', async () => {
    mount()
    const bar = await screen.findByRole('group', { name: t('mebel.summary.label') })
    expect(bar).toHaveTextContent(/\d+ plita/)
    expect(bar).toHaveTextContent(/m kromka/)
    expect(bar).toHaveTextContent(/\d+ detal/)
    fireEvent.click(within(bar).getByRole('button', { name: /plita/ }))
    expect(screen.getByRole('tab', { name: t('mebel.tab.nesting'), selected: true })).toBeInTheDocument()
    fireEvent.click(within(bar).getByRole('button', { name: /kromka/ }))
    expect(screen.getByRole('tab', { name: t('mebel.tab.edges'), selected: true })).toBeInTheDocument()
    fireEvent.click(within(bar).getByRole('button', { name: /detal/ }))
    expect(screen.getByRole('tab', { name: t('mebel.tab.parts'), selected: true })).toBeInTheDocument()
  })

  it('the price reads — while the price book is loading', async () => {
    vi.mocked(api.getPriceBook).mockReturnValue(new Promise(() => {}))
    mount()
    const bar = await screen.findByRole('group', { name: t('mebel.summary.label') })
    expect(within(bar).getByRole('button', { name: new RegExp(t('mebel.summary.price_label')) })).toHaveTextContent('—')
  })
})

describe('MebelProjectPage 3D divider and warnings', () => {
  it('the 3D view has a divider below it', async () => {
    mount()
    expect(await screen.findByRole('separator', { name: t('mebel.view3d_height') })).toBeInTheDocument()
  })

  it('the Warnings tab carries an amber count when there are warnings', async () => {
    const project = newProject('Oshxona')
    project.cabinets[0].id = 'c1'
    project.cabinets[0].width = 1200 // a wide cabinet warns
    vi.mocked(api.getMebelProject).mockResolvedValue({ id: 'p1', name: 'Oshxona', data: project })
    mount()
    const tab = await screen.findByRole('tab', { name: new RegExp(t('mebel.tab.warnings')) })
    const badge = within(tab).getByTestId('warnings-count')
    expect(badge.className).toMatch(/\bbg-warn\//)
    expect(Number(badge.textContent)).toBeGreaterThan(0)
  })
})

describe('MebelProjectPage review fixes', () => {
  it('the printout keeps day ink whatever the theme', async () => {
    vi.spyOn(window, 'print').mockImplementation(() => {})
    mount()
    await exportItem(t('mebel.export_pdf'))
    const root = await screen.findByTestId('mebel-print')
    expect(root.style.getPropertyValue('--ink')).toBe('17 24 39')
    expect(root.style.getPropertyValue('--ink-muted')).toBe('107 114 128')
    expect(root.style.getPropertyValue('--card')).toBe('255 255 255')
  })

  it('text with no colour of its own takes the theme ink, in the editor and the price book', async () => {
    mount()
    await screen.findByRole('table', { name: t('mebel.tab.parts') })
    expect(screen.getByTestId('mebel-editor')).toHaveClass('text-ink')
    fireEvent.click(screen.getByRole('button', { name: t('mebel.price_book') }))
    expect(await screen.findByRole('dialog')).toHaveClass('text-ink')
  })

  it('a direct link puts the chosen theme on <html>', async () => {
    document.documentElement.removeAttribute('data-app-theme')
    mount()
    await screen.findByRole('table', { name: t('mebel.tab.parts') })
    expect(document.documentElement.getAttribute('data-app-theme')).toMatch(/^(day|night)$/)
  })
})
