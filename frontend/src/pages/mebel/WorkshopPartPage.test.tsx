import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import WorkshopPartPage from './WorkshopPartPage'
import * as api from '@/lib/api'
import { ApiError } from '@/lib/api/client'
import i18n from '@/i18n'
import { computeProject, EMPTY_PRICE_BOOK, newProject, type FurnitureProject, type Part } from '@/features/mebel/engine'
import { partFingerprint } from '@/features/mebel/export/labels'
import { formatMm } from '@/features/mebel/ui/format'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof api>('@/lib/api')
  return { ...actual, getPublicMebelProject: vi.fn(), getCatalogMaterials: vi.fn() }
})
// The 3D view needs WebGL: a stand-in that shows what it was given.
vi.mock('@/features/mebel/three/CabinetView', () => ({
  CabinetView: ({ parts, selectedPartId }: { parts: Part[]; selectedPartId: string | null }) => (
    <div data-testid="cabinet-view" data-parts={parts.length} data-selected={selectedPartId ?? ''} />
  ),
}))

const t = (k: string, o?: Record<string, unknown>) => i18n.t(k, o)

function project(): FurnitureProject {
  const p = newProject('Oshxona')
  p.cabinets = [
    { ...p.cabinets[0], id: 'c1', label: 'M1' },
    { ...p.cabinets[0], id: 'c2', label: 'M2', position: { x: 600, z: 0 } },
  ]
  p.freeParts = [{ id: 'f1', label: 'D #1', name: 'Stoleshnitsa', length: 2400, width: 600, qty: 1, material: 'board', grain: 'length', edges: { L1: null, L2: null, W1: null, W2: null } }]
  return p
}
const parts = () => computeProject(project(), EMPTY_PRICE_BOOK, {}).parts
const drilled = () => parts().find(p => p.cabinetId === 'c1' && (p.holes?.length ?? 0) > 0)!
const fp = (p: Part) => partFingerprint(p, p.materialId ?? p.material)

let location = ''
function Probe() {
  location = useLocation().search
  return null
}

function mount(url: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/d/:token" element={<><WorkshopPartPage /><Probe /></>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.getPublicMebelProject).mockResolvedValue({ name: 'Oshxona Karimov', data: project() })
  vi.mocked(api.getCatalogMaterials).mockResolvedValue([])
})

describe('WorkshopPartPage', () => {
  it('opens without signing in and shows the scanned part: size, material, holes', async () => {
    const part = drilled()
    mount(`/d/tok?p=${encodeURIComponent(part.id)}&v=${fp(part)}`)
    const card = await screen.findByTestId('workshop-part')
    expect(api.getPublicMebelProject).toHaveBeenCalledWith('tok')
    expect(screen.getByText('Oshxona Karimov')).toBeInTheDocument()
    expect(card).toHaveTextContent(t(`mebel.part.${part.role}`))
    expect(card).toHaveTextContent('M1')
    expect(card).toHaveTextContent(`${formatMm(part.finished.length)} × ${formatMm(part.finished.width)} × ${formatMm(part.thickness)}`)
    expect(card).toHaveTextContent(t('mebel.material.board'))
    const holes = screen.getByRole('table', { name: t('mebel.drill.holes') })
    expect(within(holes).getAllByRole('row')).toHaveLength(1 + part.holes!.length)
    expect(screen.queryByText(t('mebel.workshop.changed'))).toBeNull()
  })

  it('shows no price text', async () => {
    const part = drilled()
    mount(`/d/tok?p=${encodeURIComponent(part.id)}`)
    await screen.findByTestId('workshop-part')
    expect(document.body.textContent).not.toMatch(/UZS|so'm|сум/)
  })

  it('a 404 says the link no longer works', async () => {
    vi.mocked(api.getPublicMebelProject).mockRejectedValue(new ApiError('Not found', 404))
    mount('/d/bad?p=x')
    expect(await screen.findByText(t('mebel.workshop.gone'))).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: t('mebel.workshop.retry') })).toBeNull()
  })

  it.each([
    ['a 429', new ApiError('Juda ko\'p so\'rov', 429)],
    ['a network error', new TypeError('Failed to fetch')],
  ])('%s offers a retry, not "gone"', async (_, err) => {
    vi.mocked(api.getPublicMebelProject).mockRejectedValueOnce(err)
    const part = drilled()
    mount(`/d/tok?p=${encodeURIComponent(part.id)}`)
    expect(await screen.findByText(t('mebel.workshop.load_failed'))).toBeInTheDocument()
    expect(screen.queryByText(t('mebel.workshop.gone'))).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: t('mebel.workshop.retry') }))
    expect(await screen.findByTestId('workshop-part')).toBeInTheDocument()
    expect(api.getPublicMebelProject).toHaveBeenCalledTimes(2)
  })

  it('a part not in the project says so', async () => {
    mount('/d/tok?p=nope')
    expect(await screen.findByText(t('mebel.workshop.part_missing'))).toBeInTheDocument()
    expect(screen.queryByTestId('workshop-part')).toBeNull()
  })

  it('a changed part is flagged; an unchanged one is not', async () => {
    const part = drilled()
    mount(`/d/tok?p=${encodeURIComponent(part.id)}&v=zzzzzz`)
    expect(await screen.findByText(t('mebel.workshop.changed'))).toBeInTheDocument()
    expect(screen.getByTestId('workshop-part')).toBeInTheDocument()
  })

  it('the fingerprint check does not depend on the interface language or the catalogue', async () => {
    const part = drilled()
    vi.mocked(api.getCatalogMaterials).mockRejectedValue(new Error('offline'))
    await i18n.changeLanguage('ru')
    try {
      mount(`/d/tok?p=${encodeURIComponent(part.id)}&v=${fp(part)}`)
      await screen.findByTestId('workshop-part')
      expect(screen.queryByText(i18n.t('mebel.workshop.changed'))).toBeNull()
    } finally {
      await i18n.changeLanguage('uz')
    }
  })

  it('a material the catalogue does not know still shows its generic name', async () => {
    vi.mocked(api.getCatalogMaterials).mockRejectedValue(new Error('offline'))
    const part = drilled()
    mount(`/d/tok?p=${encodeURIComponent(part.id)}`)
    expect(await screen.findByTestId('workshop-part')).toHaveTextContent(t('mebel.material.board'))
  })

  it('a malformed project says to ask the owner, without a retry that cannot help', async () => {
    vi.mocked(api.getPublicMebelProject).mockResolvedValue({ name: 'x', data: {} as FurnitureProject })
    mount('/d/tok?p=x')
    expect(await screen.findByText(t('mebel.workshop.broken'))).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: t('mebel.workshop.retry') })).toBeNull()
  })

  it('a project the engine rejects says to ask the owner', async () => {
    const bad = project()
    bad.cabinets[0].width = 5
    vi.mocked(api.getPublicMebelProject).mockResolvedValue({ name: 'x', data: bad })
    mount('/d/tok?p=x')
    expect(await screen.findByText(t('mebel.workshop.broken'))).toBeInTheDocument()
  })

  it('an encoded part id is read back', async () => {
    // a free part's part id is its label + piece number: "D #1-1"
    mount(`/d/tok?p=${encodeURIComponent('D #1-1')}`)
    const card = await screen.findByTestId('workshop-part')
    expect(card).toHaveTextContent('Stoleshnitsa')
    expect(card).toHaveTextContent('D #1')
    expect(screen.getByText(t('mebel.workshop.no_holes'))).toBeInTheDocument()
  })

  it('with no part chosen, asks to choose one', async () => {
    mount('/d/tok')
    expect(await screen.findByText(t('mebel.workshop.pick_part'))).toBeInTheDocument()
    expect(location).toBe('')
  })

  it('lists the order\'s parts by cabinet; tapping one selects it and replaces ?p', async () => {
    const part = drilled()
    const other = parts().find(p => p.cabinetId === 'c2')!
    mount(`/d/tok?p=${encodeURIComponent(part.id)}&v=zzzzzz`)
    await screen.findByTestId('workshop-part')
    const list = screen.getByRole('region', { name: t('mebel.workshop.other_parts') })
    expect(within(list).getByRole('heading', { name: 'M1' })).toBeInTheDocument()
    expect(within(list).getByRole('heading', { name: 'M2' })).toBeInTheDocument()
    expect(within(list).getByRole('heading', { name: 'D #1' })).toBeInTheDocument()
    const historyBefore = window.history.length
    fireEvent.click(within(list).getByRole('button', { name: new RegExp(other.id) }))
    await waitFor(() => expect(location).toBe(`?p=${encodeURIComponent(other.id)}`))
    expect(window.history.length).toBe(historyBefore)
    expect(screen.getByTestId('workshop-part')).toHaveTextContent(other.id)
    // the "changed" note was about the scanned part only
    expect(screen.queryByText(t('mebel.workshop.changed'))).toBeNull()
  })

  it('with no part chosen, the list is there to choose from', async () => {
    mount('/d/tok')
    expect(await screen.findByRole('region', { name: t('mebel.workshop.other_parts') })).toBeInTheDocument()
  })

  it('each cabinet group opens its assembly drawing', async () => {
    mount(`/d/tok?p=${encodeURIComponent(drilled().id)}`)
    const list = await screen.findByRole('region', { name: t('mebel.workshop.other_parts') })
    expect(screen.queryByRole('img', { name: /^M1 — / })).toBeNull()
    fireEvent.click(within(list).getAllByRole('button', { name: t('mebel.workshop.assembly') })[0])
    expect(screen.getAllByRole('img', { name: /^M1 — / }).length).toBeGreaterThan(0)
  })

  it('3D is not loaded until asked for, then shows the part\'s cabinet with it selected', async () => {
    const part = drilled()
    mount(`/d/tok?p=${encodeURIComponent(part.id)}`)
    await screen.findByTestId('workshop-part')
    expect(screen.queryByTestId('cabinet-view')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: t('mebel.workshop.view_3d') }))
    const view = await screen.findByTestId('cabinet-view')
    expect(view.dataset.selected).toBe(part.id)
    expect(Number(view.dataset.parts)).toBe(parts().filter(p => p.cabinetId === 'c1').length)
  })

  it('a long name and many parts do not widen the page', async () => {
    vi.mocked(api.getPublicMebelProject).mockResolvedValue({ name: 'Juda uzun loyiha nomi '.repeat(10), data: project() })
    mount(`/d/tok?p=${encodeURIComponent(drilled().id)}`)
    expect(await screen.findByTestId('workshop-name')).toHaveClass('truncate')
    const list = screen.getByRole('region', { name: t('mebel.workshop.other_parts') })
    for (const row of within(list).getAllByTestId('workshop-row')) {
      expect(row).toHaveClass('min-w-0')
      expect(row.querySelector('.truncate')).not.toBeNull()
    }
  })
})
