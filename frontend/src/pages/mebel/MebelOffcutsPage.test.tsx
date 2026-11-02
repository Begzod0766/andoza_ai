import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import MebelOffcutsPage from './MebelOffcutsPage'
import * as api from '@/lib/api'
import i18n from '@/i18n'
import { ConfirmProvider } from '@/components/ui/ConfirmDialog'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof api>('@/lib/api')
  return { ...actual, listOffcuts: vi.fn(), addOffcut: vi.fn(), deleteOffcut: vi.fn(), listMebelProjects: vi.fn(), getCatalogMaterials: vi.fn() }
})

const t = (k: string, o?: Record<string, unknown>) => i18n.t(k, o)
const off = (o: Partial<api.MebelOffcut>): api.MebelOffcut => ({
  id: 'o1', material: 'board', materialId: null, thickness: 18, length: 800, width: 600, source_project_id: null, created_at: '2026-11-01T10:00:00Z', ...o,
})

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ConfirmProvider>
        <MemoryRouter><MebelOffcutsPage /></MemoryRouter>
      </ConfirmProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.listMebelProjects).mockResolvedValue([{ id: 'p1', name: 'Oshxona', updated_at: '2026-11-01T10:00:00Z' }])
  vi.mocked(api.getCatalogMaterials).mockResolvedValue([])
})

describe('MebelOffcutsPage', () => {
  it('lists offcuts grouped by material and thickness, with where they came from', async () => {
    vi.mocked(api.listOffcuts).mockResolvedValue([
      off({ id: 'a', source_project_id: 'p1' }),
      off({ id: 'b', length: 1200, width: 400 }),
      off({ id: 'c', material: 'back', thickness: 4, length: 900, width: 500 }),
    ])
    mount()
    const board = (await screen.findByRole('heading', { name: t('mebel.offcuts.group', { m: t('mebel.material.board'), t: 18 }) })).closest('section')!
    expect(within(board).getAllByRole('listitem')).toHaveLength(2)
    expect(within(board).getByText(/Oshxona/)).toBeInTheDocument()
    expect(within(board).getByText(new RegExp(t('mebel.offcuts.by_hand')))).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: t('mebel.offcuts.group', { m: t('mebel.material.back'), t: 4 }) })).toBeInTheDocument()
  })

  it('says when the store is empty', async () => {
    vi.mocked(api.listOffcuts).mockResolvedValue([])
    mount()
    expect(await screen.findByText(t('mebel.offcuts.empty'))).toBeInTheDocument()
  })

  it('adds an offcut by hand', async () => {
    vi.mocked(api.listOffcuts).mockResolvedValue([])
    vi.mocked(api.addOffcut).mockResolvedValue(off({}))
    mount()
    await screen.findByText(t('mebel.offcuts.empty'))
    fireEvent.change(screen.getByLabelText(t('mebel.free.length')), { target: { value: '1000' } })
    fireEvent.change(screen.getByLabelText(t('mebel.free.width')), { target: { value: '450' } })
    fireEvent.click(screen.getByRole('button', { name: t('mebel.offcuts.add') }))
    await waitFor(() => expect(api.addOffcut).toHaveBeenCalledWith({ material: 'board', materialId: null, thickness: 18, length: 1000, width: 450 }))
  })

  it('deleting asks first', async () => {
    vi.mocked(api.listOffcuts).mockResolvedValue([off({})])
    vi.mocked(api.deleteOffcut).mockResolvedValue()
    mount()
    fireEvent.click(await screen.findByRole('button', { name: t('mebel.delete') }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: t('mebel.delete') }))
    await waitFor(() => expect(api.deleteOffcut).toHaveBeenCalledWith('o1'))
  })
})
