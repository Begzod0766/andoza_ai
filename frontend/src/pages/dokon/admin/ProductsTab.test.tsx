import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProductsTab } from './ProductsTab'

const api = vi.hoisted(() => ({
  getProductsOverview: vi.fn(),
  listAdminProducts: vi.fn(),
  listAdminStores: vi.fn(),
  updateAdminMaterial: vi.fn(),
  getAdminMaterial: vi.fn(),
  getAdminFurniture: vi.fn(),
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
vi.mock('./ModelFormDialog', () => ({
  ModelFormDialog: ({ open }: { open: boolean }) => (open ? <p>model-upload-dialog</p> : null),
}))

const product = (over: Record<string, unknown> = {}) => ({
  kind: 'materials', id: 'm1', name: 'Laminat dub', store_id: 's1', store_name: 'MAFF', category: 'laminat',
  price_uzs: 120_000, unit: 'm2', image_url: null, is_active: true, ...over,
})
const laminat = Array.from({ length: 5 }, (_, i) => product({ id: `m${i + 1}`, name: `Laminat ${i + 1}` }))
const overview = () => ({
  total: 14,
  categories: [
    { kind: 'materials', category: 'laminat', total: 12, items: laminat },
    { kind: 'furniture', category: 'divan', total: 1, items: [product({ kind: 'furniture', id: 'f1', name: 'Divan Oslo', category: 'divan', price_uzs: null, store_id: null, store_name: null, unit: null })] },
    { kind: 'materials', category: 'ldsp', total: 1, items: [product({ id: 'm9', name: 'LDSP oq', category: 'ldsp', is_active: false })] },
  ],
})

let qc: QueryClient
function mount() {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const onError = vi.fn()
  render(<QueryClientProvider client={qc}><ProductsTab onError={onError} /></QueryClientProvider>)
  return { onError }
}
const side = () => screen.getByRole('navigation', { name: 'Kategoriyalar' })
const row = (name: string) => screen.getByText(name).closest('li') as HTMLElement

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset())
  api.getProductsOverview.mockResolvedValue(overview())
  api.listAdminProducts.mockResolvedValue({ items: [], total: 0 })
  api.listAdminStores.mockResolvedValue([{ id: 's1', name: 'MAFF' }])
  api.getAdminMaterial.mockImplementation(async (id: string) => ({ id, name_uz: `full ${id}` }))
  api.getAdminFurniture.mockImplementation(async (id: string) => ({ id, name_uz: `full ${id}` }))
})

describe('ProductsTab — overview', () => {
  it('header shows Tovarlar (total) and the add menu opens both dialogs', async () => {
    mount()
    expect(await screen.findByRole('heading', { name: 'Tovarlar (14)' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: "Qo'shish" }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Material' }))
    expect(screen.getByText('material-dialog:new')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: "Qo'shish" }))
    fireEvent.click(screen.getByRole('menuitem', { name: '3D model' }))
    expect(screen.getByText('model-upload-dialog')).toBeInTheDocument()
  })

  it('one block per category: label and total, its rows, and "Barchasini ko\'rish" only above 5', async () => {
    mount()
    const block = await screen.findByRole('region', { name: /Laminat/ })
    expect(within(block).getByText('12')).toBeInTheDocument()
    expect(within(block).getAllByRole('listitem')).toHaveLength(5)
    expect(within(block).getByRole('button', { name: "Barchasini ko'rish (12)" })).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: /Divan/ })).queryByRole('button', { name: /Barchasini/ })).toBeNull()
  })

  it('"Barchasini ko\'rish" opens that category', async () => {
    mount()
    fireEvent.click(await screen.findByRole('button', { name: "Barchasini ko'rish (12)" }))
    await waitFor(() => expect(api.listAdminProducts).toHaveBeenLastCalledWith(expect.objectContaining({ category: 'laminat', kind: 'materials', page: 1 })))
  })

  it('kind, status, shop and a debounced search reach the overview', async () => {
    mount()
    await screen.findByRole('heading', { name: 'Tovarlar (14)' })
    fireEvent.click(within(screen.getByRole('group', { name: 'Turi' })).getByRole('button', { name: 'Mebel' }))
    fireEvent.click(within(screen.getByRole('group', { name: 'Holat' })).getByRole('button', { name: 'Yashirin' }))
    fireEvent.change(screen.getByLabelText("Do'kon"), { target: { value: 's1' } })
    fireEvent.change(screen.getByLabelText("Nomi bo'yicha qidirish"), { target: { value: 'oslo' } })
    await waitFor(() => expect(api.getProductsOverview).toHaveBeenLastCalledWith({ kind: 'furniture', status: 'hidden', store_id: 's1', q: 'oslo' }))
  })

  it('left column: Hamma kategoriyalar first with the total; the category search narrows it', async () => {
    mount()
    await screen.findByRole('heading', { name: 'Tovarlar (14)' })
    const entries = within(side()).getAllByRole('button')
    expect(entries[0]).toHaveTextContent('Hamma kategoriyalar')
    expect(entries[0]).toHaveTextContent('14')
    fireEvent.change(screen.getByLabelText('Kategoriya qidirish'), { target: { value: 'div' } })
    expect(within(side()).getAllByRole('button').map((b) => b.textContent)).toEqual(['Hamma kategoriyalar14', 'Divan1'])
  })

  it('two kinds with the same label are told apart by a kind icon', async () => {
    api.getProductsOverview.mockResolvedValue({
      total: 2,
      categories: [
        { kind: 'furniture', category: 'xyz', total: 1, items: [product({ kind: 'furniture', id: 'f2', category: 'xyz', name: 'Alpha model' })] },
        { kind: 'materials', category: 'xyz', total: 1, items: [product({ id: 'm2', category: 'xyz', name: 'Beta material' })] },
      ],
    })
    mount()
    await screen.findByText('Alpha model')
    const xyz = within(side()).getAllByRole('button', { name: /xyz/ })
    expect(xyz).toHaveLength(2)
    expect(xyz.map((b) => b.getAttribute('aria-label'))).toEqual(expect.arrayContaining(['xyz · 3D model', 'xyz · Material']))
  })
})

describe('ProductsTab — rows', () => {
  it('a row click loads the full object and opens the material or the model dialog', async () => {
    mount()
    await screen.findByText('Laminat 1')
    fireEvent.click(within(row('Laminat 1')).getByRole('button', { name: /Laminat 1/ }))
    expect(await screen.findByText('material-dialog:full m1')).toBeInTheDocument()
    fireEvent.click(within(row('Divan Oslo')).getByRole('button', { name: /Divan Oslo/ }))
    expect(await screen.findByText('model-dialog:full f1')).toBeInTheDocument()
  })

  it('a model with no price and no shop shows — and still opens', async () => {
    mount()
    await screen.findByText('Divan Oslo')
    expect(within(row('Divan Oslo')).getAllByText('—').length).toBeGreaterThanOrEqual(1)
    fireEvent.click(within(row('Divan Oslo')).getByRole('button', { name: /Divan Oslo/ }))
    expect(await screen.findByText('model-dialog:full f1')).toBeInTheDocument()
  })

  it('⋯ hides a material and refetches the admin lists', async () => {
    api.updateAdminMaterial.mockResolvedValue({})
    mount()
    await screen.findByText('Laminat 1')
    const invalidate = vi.spyOn(qc, 'invalidateQueries')
    fireEvent.click(within(row('Laminat 1')).getByRole('button', { name: 'Amallar' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Yashirish' }))
    await waitFor(() => expect(api.updateAdminMaterial).toHaveBeenCalledWith('m1', { is_active: false }))
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['admin'] }))
  })

  it('only hidden rows carry a Yashirin pill; no Faol pill on rows', async () => {
    mount()
    await screen.findByText('LDSP oq')
    expect(within(row('LDSP oq')).getByText('Yashirin')).toBeInTheDocument()
    expect(within(row('Laminat 1')).queryByText('Yashirin')).toBeNull()
    expect(within(row('Laminat 1')).queryByText('Faol')).toBeNull()
  })

  it('nothing matches: an empty note and only "Hamma kategoriyalar"', async () => {
    api.getProductsOverview.mockResolvedValue({ total: 0, categories: [] })
    mount()
    expect(await screen.findByText('Tovar topilmadi')).toBeInTheDocument()
    expect(within(side()).getAllByRole('button')).toHaveLength(1)
  })
})

describe('ProductsTab — one category', () => {
  const page = (n: number, total = 60) => ({
    items: Array.from({ length: 2 }, (_, i) => product({ id: `p${n}-${i}`, name: `Page ${n} item ${i}` })),
    total,
  })

  it('lists 25 a page and the pager loads page 2', async () => {
    api.listAdminProducts.mockImplementation(async ({ page: n }: { page: number }) => page(n))
    mount()
    fireEvent.click(await screen.findByRole('button', { name: "Barchasini ko'rish (12)" }))
    expect(await screen.findByText('Page 1 item 0')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '2' }))
    expect(await screen.findByText('Page 2 item 0')).toBeInTheDocument()
    expect(api.listAdminProducts).toHaveBeenLastCalledWith(expect.objectContaining({ category: 'laminat', page: 2 }))
    expect(screen.getByRole('navigation', { name: 'Sahifalar' }).textContent).toBe('123')
  })

  it('a filter change or another category goes back to page 1', async () => {
    api.listAdminProducts.mockImplementation(async ({ page: n }: { page: number }) => page(n))
    mount()
    fireEvent.click(await screen.findByRole('button', { name: "Barchasini ko'rish (12)" }))
    fireEvent.click(await screen.findByRole('button', { name: '3' }))
    await screen.findByText('Page 3 item 0')
    fireEvent.click(within(screen.getByRole('group', { name: 'Holat' })).getByRole('button', { name: 'Faol' }))
    await waitFor(() => expect(api.listAdminProducts).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'active', page: 1 })))
    fireEvent.click(await screen.findByRole('button', { name: '3' }))
    await screen.findByText('Page 3 item 0')
    fireEvent.click(within(side()).getByRole('button', { name: /Divan/ }))
    await waitFor(() => expect(api.listAdminProducts).toHaveBeenLastCalledWith(expect.objectContaining({ category: 'divan', page: 1 })))
  })

  it('Hamma kategoriyalar returns to the blocks', async () => {
    api.listAdminProducts.mockResolvedValue(page(1))
    mount()
    fireEvent.click(await screen.findByRole('button', { name: "Barchasini ko'rish (12)" }))
    await screen.findByText('Page 1 item 0')
    fireEvent.click(within(side()).getAllByRole('button')[0])
    expect(await screen.findByRole('button', { name: "Barchasini ko'rish (12)" })).toBeInTheDocument()
  })

  it('on a phone the price sits under the name, from md in its own column', async () => {
    mount()
    await screen.findByText('Laminat 1')
    const prices = within(row('Laminat 1')).getAllByText(/120/)
    expect(prices).toHaveLength(2)
    expect(prices[0]).toHaveClass('md:hidden')
    expect(prices[1]).toHaveClass('hidden', 'md:block')
  })
})
