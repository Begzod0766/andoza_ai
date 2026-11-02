import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProductsTab } from './ProductsTab'

const api = vi.hoisted(() => ({
  listAdminMaterials: vi.fn(),
  listAdminFurniture: vi.fn(),
  getCategoryCounts: vi.fn(),
  listAdminStores: vi.fn(),
  updateAdminMaterial: vi.fn(),
}))
vi.mock('@/lib/api', async () => {
  const real = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return {
    MATERIAL_CATEGORIES: real.MATERIAL_CATEGORIES,
    MATERIAL_UNITS: real.MATERIAL_UNITS,
    ...Object.fromEntries(Object.entries(api).map(([k, v]) => [k, (...a: unknown[]) => v(...a)])),
  }
})
vi.mock('./MaterialFormDialog', () => ({
  MaterialFormDialog: ({ open, material }: { open: boolean; material?: { name_uz: string } | null }) =>
    open ? <p>material-dialog:{material?.name_uz ?? 'new'}</p> : null,
}))
vi.mock('./ModelEditDialog', () => ({
  ModelEditDialog: ({ open, model }: { open: boolean; model: { name_uz: string } | null }) =>
    open ? <p>model-dialog:{model?.name_uz}</p> : null,
}))
vi.mock('./ModelFormDialog', () => ({ ModelFormDialog: () => null }))

const material = (over: Record<string, unknown> = {}) => ({
  id: 'm1', store_id: 's1', store_name: 'Qurilish Mart', category: 'laminat', name_uz: 'Laminat dub', unit: 'm2',
  price_uzs: 120_000, pack_qty: null, pack_unit: null, smeta_key: null, is_active: true, image_url: null, ...over,
})
const model = (over: Record<string, unknown> = {}) => ({
  id: 'f1', store_id: 's1', store_name: 'Mebel Plus', category: 'divan', name_uz: 'Divan Oslo', price_uzs: 4_500_000,
  thumbnail_url: null, is_active: true, room_type: null, placement: 'pol', ...over,
})
const page = (items: unknown[]) => ({ items, total: items.length, page: 1, per_page: 50 })

function mount() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={qc}><ProductsTab onError={vi.fn()} /></QueryClientProvider>)
}

const categories = () => screen.getByRole('navigation', { name: 'Kategoriyalar' })

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset())
  api.listAdminStores.mockResolvedValue([{ id: 's1', name: 'Mebel Plus' }])
  api.getCategoryCounts.mockResolvedValue({ materials: { laminat: 2, ldsp: 1 }, furniture: { divan: 1 } })
  api.listAdminMaterials.mockResolvedValue(page([material(), material({ id: 'm2', name_uz: 'Laminat yong\'oq' }), material({ id: 'm3', category: 'ldsp', name_uz: 'LDSP oq', is_active: false })]))
  api.listAdminFurniture.mockResolvedValue([model()])
})

describe('ProductsTab', () => {
  it('lists categories with counts, "Hamma kategoriyalar" first', async () => {
    mount()
    const items = await within(await screen.findByRole('navigation', { name: 'Kategoriyalar' })).findAllByRole('button')
    expect(items[0]).toHaveTextContent('Hamma kategoriyalar')
    expect(items[0]).toHaveTextContent('4')
    expect(within(categories()).getByRole('button', { name: /Laminat.*2/ })).toBeInTheDocument()
    expect(within(categories()).getByRole('button', { name: /Divan.*1/ })).toBeInTheDocument()
  })

  it('groups rows under category headings when every category shows', async () => {
    mount()
    const laminat = await screen.findByRole('region', { name: /Laminat/ })
    expect(within(laminat).getByText('Laminat dub')).toBeInTheDocument()
    expect(within(laminat).queryByText('Divan Oslo')).toBeNull()
    expect(within(screen.getByRole('region', { name: /Divan/ })).getByText('Divan Oslo')).toBeInTheDocument()
  })

  it('a category narrows the list and the request to that kind', async () => {
    mount()
    fireEvent.click(await within(await screen.findByRole('navigation', { name: 'Kategoriyalar' })).findByRole('button', { name: /Divan/ }))
    await waitFor(() => expect(api.listAdminFurniture).toHaveBeenLastCalledWith(expect.objectContaining({ category: 'divan' })))
    expect(await screen.findByText('Divan Oslo')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('Laminat dub')).toBeNull())
  })

  it('the kind switch shows only that kind', async () => {
    mount()
    await screen.findByText('Divan Oslo')
    fireEvent.click(within(screen.getByRole('group', { name: 'Turi' })).getByRole('button', { name: 'Mebel' }))
    await waitFor(() => expect(screen.queryByText('Laminat dub')).toBeNull())
    expect(screen.getByText('Divan Oslo')).toBeInTheDocument()
    expect(within(categories()).queryByRole('button', { name: /Laminat/ })).toBeNull()
  })

  it('search is debounced and goes to both lists and the counts', async () => {
    mount()
    await screen.findByText('Divan Oslo')
    fireEvent.change(screen.getByLabelText("Nomi bo'yicha qidirish"), { target: { value: 'oslo' } })
    expect(api.getCategoryCounts).not.toHaveBeenLastCalledWith(expect.objectContaining({ q: 'oslo' }))
    await waitFor(() => {
      expect(api.getCategoryCounts).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'oslo' }))
      expect(api.listAdminFurniture).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'oslo' }))
      expect(api.listAdminMaterials).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'oslo' }))
    })
  })

  it('Yashirin keeps only hidden rows', async () => {
    mount()
    await screen.findByText('LDSP oq')
    fireEvent.click(within(screen.getByRole('group', { name: 'Holat' })).getByRole('button', { name: 'Yashirin' }))
    expect(screen.getByText('LDSP oq')).toBeInTheDocument()
    expect(screen.queryByText('Laminat dub')).toBeNull()
    expect(screen.queryByText('Divan Oslo')).toBeNull()
  })

  it('Tahrirlash opens the material or the model dialog', async () => {
    mount()
    const row = (name: string) => screen.getByText(name).closest('li') as HTMLElement
    await screen.findByText('Divan Oslo')
    fireEvent.click(within(row('Laminat dub')).getByRole('button', { name: 'Tahrirlash' }))
    expect(screen.getByText('material-dialog:Laminat dub')).toBeInTheDocument()
    fireEvent.click(within(row('Divan Oslo')).getByRole('button', { name: 'Tahrirlash' }))
    expect(screen.getByText('model-dialog:Divan Oslo')).toBeInTheDocument()
  })

  it('hides a material from its row, as the old list did', async () => {
    api.updateAdminMaterial.mockResolvedValue({})
    mount()
    await screen.findByText('Laminat dub')
    const row = screen.getByText('Laminat dub').closest('li') as HTMLElement
    fireEvent.click(within(row).getByRole('button', { name: 'Yashirish' }))
    await waitFor(() => expect(api.updateAdminMaterial).toHaveBeenCalledWith('m1', { is_active: false }))
  })

  it('with nothing to show: only "Hamma kategoriyalar" and an empty note', async () => {
    api.getCategoryCounts.mockResolvedValue({ materials: {}, furniture: {} })
    api.listAdminMaterials.mockResolvedValue(page([]))
    api.listAdminFurniture.mockResolvedValue([])
    mount()
    expect(await screen.findByText('Tovar topilmadi')).toBeInTheDocument()
    expect(within(categories()).getAllByRole('button')).toHaveLength(1)
  })
})
