import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AdminOrders } from './AdminOrders'

const api = vi.hoisted(() => ({ listAdminOrders: vi.fn(), setAdminOrderStatus: vi.fn(), listAdminStores: vi.fn() }))
vi.mock('@/lib/api', () => ({
  listAdminOrders: (...a: unknown[]) => api.listAdminOrders(...a),
  setAdminOrderStatus: (...a: unknown[]) => api.setAdminOrderStatus(...a),
  listAdminStores: (...a: unknown[]) => api.listAdminStores(...a),
}))
const called = (over: Record<string, unknown>) => expect.objectContaining({ page: 1, ...over })
/** Opens the row of the order whose number starts with *no*. */
const open = async (no = 'AAAABBBB') => fireEvent.click(await screen.findByRole('button', { name: new RegExp(no) }))

const order = (over: Record<string, unknown> = {}) => ({
  id: 'aaaabbbb-0000-4000-8000-000000000001', user_id: 'u1', store_id: 's1', store_name: 'Mebel Plus', dealer_name: 'Mebel Plus',
  total_uzs: 4_500_000, status: 'accepted', delivery_address: 'Chilonzor 5', phone: '+998 90 123 45 67', payment_method: 'cash',
  cancelled_by: null, cancel_reason: null, created_at: '2026-10-08T08:00:00Z',
  lines: [{ id: 'l1', material_id: null, furniture_id: 'f1', product_name: 'Divan', unit: 'dona', unit_price_uzs: 4_500_000, quantity: 1 }],
  ...over,
})

function mount(onError = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={qc}><AdminOrders onError={onError} /></QueryClientProvider>)
  return { onError }
}

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset())
  api.listAdminStores.mockResolvedValue([{ id: 's1', name: 'Mebel Plus' }, { id: 's2', name: 'Ideal' }])
})

describe('AdminOrders', () => {
  it('lists orders with their shop, buyer details and lines', async () => {
    api.listAdminOrders.mockResolvedValue([order()])
    mount()
    await open()
    expect(screen.getAllByText(/Mebel Plus/).length).toBeGreaterThan(0)
    expect(screen.getByText('Chilonzor 5')).toBeInTheDocument()
    expect(screen.getByText(/Divan/)).toBeInTheDocument()
    expect(api.listAdminOrders).toHaveBeenCalledWith(called({ status: undefined }))
  })

  it('says when an order belongs to no shop, since only an administrator can act on it', async () => {
    api.listAdminOrders.mockResolvedValue([order({ store_id: null, store_name: null, dealer_name: "Do'kon" })])
    mount()
    await open()
    expect(await screen.findByText(/do'konsiz mahsulot/)).toBeInTheDocument()
  })

  it('asks the server for one stage when a filter is chosen', async () => {
    api.listAdminOrders.mockResolvedValue([])
    mount()
    await screen.findByText('Buyurtma topilmadi.')
    fireEvent.click(within(screen.getByRole('group', { name: "Holat bo'yicha" })).getByRole('button', { name: 'Yo\'lda' }))
    await waitFor(() => expect(api.listAdminOrders).toHaveBeenLastCalledWith(called({ status: 'on_the_way' })))
  })

  it('marks exactly one stage chip as chosen, and Hammasi goes back to every order', async () => {
    api.listAdminOrders.mockResolvedValue([])
    mount()
    await screen.findByText('Buyurtma topilmadi.')
    const stages = screen.getByRole('group', { name: "Holat bo'yicha" })
    const chip = (name: string) => within(stages).getByRole('button', { name })
    expect(chip('Hammasi')).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(chip('Yetkazildi'))
    expect(chip('Yetkazildi')).toHaveAttribute('aria-pressed', 'true')
    expect(chip('Hammasi')).toHaveAttribute('aria-pressed', 'false')
    expect(within(stages).getAllByRole('button', { pressed: true })).toHaveLength(1)
    await waitFor(() => expect(api.listAdminOrders).toHaveBeenLastCalledWith(called({ status: 'delivered' })))
    fireEvent.click(chip('Hammasi'))
    await waitFor(() => expect(api.listAdminOrders).toHaveBeenLastCalledWith(called({ status: undefined })))
  })

  it('moves an order to its next stage', async () => {
    api.listAdminOrders.mockResolvedValue([order()])
    api.setAdminOrderStatus.mockResolvedValue(order({ status: 'gathering' }))
    mount()
    await open()
    fireEvent.click(await screen.findByRole('button', { name: "Yig'ishni boshlash" }))
    await waitFor(() => expect(api.setAdminOrderStatus).toHaveBeenCalledWith('aaaabbbb-0000-4000-8000-000000000001', 'gathering'))
  })

  it('cancels with a reason', async () => {
    api.listAdminOrders.mockResolvedValue([order({ status: 'on_the_way' })])
    api.setAdminOrderStatus.mockResolvedValue(order({ status: 'cancelled' }))
    mount()
    await open()
    fireEvent.click(await screen.findByRole('button', { name: 'Bekor qilish' }))
    const confirm = screen.getByRole('button', { name: 'Bekor qilishni tasdiqlash' })
    expect(confirm).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Bekor qilish sababi'), { target: { value: "Yo'qolgan" } })
    fireEvent.click(confirm)
    await waitFor(() => expect(api.setAdminOrderStatus).toHaveBeenCalledWith('aaaabbbb-0000-4000-8000-000000000001', 'cancelled', "Yo'qolgan"))
  })

  it('cannot touch a delivered order and shows why a cancelled one was cancelled', async () => {
    api.listAdminOrders.mockResolvedValue([
      order({ status: 'delivered' }),
      order({ id: 'ccccdddd-0000-4000-8000-000000000002', status: 'cancelled', cancelled_by: 'buyer', cancel_reason: 'Fikrim o\'zgardi' }),
    ])
    mount()
    await open('CCCCDDDD')
    await screen.findByText(/Bekor qilgan: xaridor/)
    expect(screen.getByText(/Fikrim o'zgardi/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Bekor qilish' })).toBeNull()
  })

  it('filters by shop, period and a debounced search', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date(2026, 10, 2, 15, 30))
    try {
      api.listAdminOrders.mockResolvedValue([])
      mount()
      await screen.findByText('Buyurtma topilmadi.')
      fireEvent.change(await screen.findByLabelText("Do'kon"), { target: { value: 's2' } })
      await waitFor(() => expect(api.listAdminOrders).toHaveBeenLastCalledWith(called({ store_id: 's2' })))
      fireEvent.click(screen.getByRole('button', { name: 'Bugun' }))
      const today = new Date(2026, 10, 2).toISOString()
      await waitFor(() => expect(api.listAdminOrders).toHaveBeenLastCalledWith(called({ store_id: 's2', since: today })))
      const calls = api.listAdminOrders.mock.calls.length
      fireEvent.change(screen.getByLabelText('Raqam yoki telefon'), { target: { value: '90 12' } })
      expect(api.listAdminOrders).toHaveBeenCalledTimes(calls) // not yet: debounced
      await vi.advanceTimersByTimeAsync(350)
      await waitFor(() => expect(api.listAdminOrders).toHaveBeenLastCalledWith(called({ q: '90 12', since: today })))
    } finally {
      vi.useRealTimers()
    }
  })

  it('shows the table columns and opens one row at a time', async () => {
    api.listAdminOrders.mockResolvedValue([
      order(),
      order({ id: 'ccccdddd-0000-4000-8000-000000000002', delivery_address: 'Yunusobod 9' }),
    ])
    mount()
    for (const col of ['№', "Do'kon", 'Telefon', 'Sana', 'Tovarlar', 'Summa', 'Holat']) {
      expect(await screen.findByRole('columnheader', { name: col })).toBeInTheDocument()
    }
    await open()
    expect(screen.getByText('Chilonzor 5')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /AAAABBBB/ })).toHaveAttribute('aria-expanded', 'true')
    await open('CCCCDDDD')
    expect(screen.getByText('Yunusobod 9')).toBeInTheDocument()
    expect(screen.queryByText('Chilonzor 5')).toBeNull()
  })

  it('a phone row shows a short sum, and the wide columns wait for md', async () => {
    api.listAdminOrders.mockResolvedValue([order()])
    mount()
    const row = await screen.findByRole('button', { name: /AAAABBBB/ })
    expect(within(row).getByText("4.5 mln so'm")).toHaveClass('md:hidden')
    expect(within(row).getByText('4 500 000 soʻm')).toHaveClass('hidden', 'md:inline')
    expect(within(row).getByText('+998 90 123 45 67')).toHaveClass('hidden', 'md:block')
  })

  it('closes the open row when a filter drops its order', async () => {
    api.listAdminOrders.mockResolvedValueOnce([order()]).mockResolvedValue([])
    mount()
    await open()
    expect(screen.getByText('Chilonzor 5')).toBeInTheDocument()
    const stages = screen.getByRole('group', { name: "Holat bo'yicha" })
    fireEvent.click(within(stages).getByRole('button', { name: 'Yetkazildi' }))
    await screen.findByText('Buyurtma topilmadi.')
    api.listAdminOrders.mockResolvedValue([order()])
    fireEvent.click(within(stages).getByRole('button', { name: 'Hammasi' }))
    await screen.findByRole('button', { name: /AAAABBBB/ })
    expect(screen.queryByText('Chilonzor 5')).toBeNull()
  })

  it('reports a refusal to the page', async () => {
    api.listAdminOrders.mockResolvedValue([order()])
    api.setAdminOrderStatus.mockRejectedValue(new Error(JSON.stringify({ detail: 'Buyurtma topilmadi' })))
    const { onError } = mount()
    await open()
    fireEvent.click(await screen.findByRole('button', { name: "Yig'ishni boshlash" }))
    await waitFor(() => expect(onError).toHaveBeenCalledWith('Buyurtma topilmadi'))
  })
})


describe('AdminOrders: many orders', () => {
  const many = (n: number, from = 0) => Array.from({ length: n }, (_, i) => order({ id: `${String(from + i).padStart(8, '0')}-0000-4000-8000-000000000000` }))

  it('offers more only when a whole page came back, and fetches the next page', async () => {
    api.listAdminOrders.mockResolvedValueOnce(many(50)).mockResolvedValueOnce(many(3, 50))
    mount()
    fireEvent.click(await screen.findByRole('button', { name: "Ko'proq ko'rsatish" }))
    await waitFor(() => expect(api.listAdminOrders).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })))
    await waitFor(() => expect(screen.getByText('Buyurtmalar (53)')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: "Ko'proq ko'rsatish" })).toBeNull() // the second page was short
  })

  it('does not offer more for a short page', async () => {
    api.listAdminOrders.mockResolvedValue(many(3))
    mount()
    await screen.findByText('Buyurtmalar (3)')
    expect(screen.queryByRole('button', { name: "Ko'proq ko'rsatish" })).toBeNull()
  })

  it('hints that there is more while a full page is showing', async () => {
    api.listAdminOrders.mockResolvedValue(many(50))
    mount()
    expect(await screen.findByText('Buyurtmalar (50+)')).toBeInTheDocument()
  })
})
