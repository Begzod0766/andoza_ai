import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, useLocation } from 'react-router-dom'
import AdminCatalogPanel from './AdminCatalogPanel'

const pending = vi.hoisted(() => ({ getPendingQueue: vi.fn(), listAdminOrders: vi.fn() }))
vi.mock('@/lib/api', () => ({
  getPendingQueue: (...a: unknown[]) => pending.getPendingQueue(...a),
  listAdminOrders: (...a: unknown[]) => pending.listAdminOrders(...a),
}))
// The tabs' own contents are tested on their own; here only which one shows.
vi.mock('./admin/ModerationQueue', () => ({ ModerationQueue: () => <p>moderation-panel</p> }))
vi.mock('./admin/AdminOrders', () => ({ AdminOrders: () => <p>orders-panel</p> }))
vi.mock('./admin/AdminMaterials', () => ({ AdminMaterials: () => <p>products-panel</p> }))
vi.mock('./admin/CatalogOverview', () => ({ CatalogOverview: () => <p>stores-panel</p> }))
vi.mock('./admin/StoreProfile', () => ({ StoreProfile: () => <p>store-profile</p> }))

let location = { search: '' }
function Probe() {
  const l = useLocation()
  location = { search: l.search }
  return null
}

function mount(url = '/dokon') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[url]}>
        <AdminCatalogPanel />
        <Probe />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const queue = (n: number) => ({ stores: Array.from({ length: n }, (_, i) => ({ id: `s${i}` })), furniture: [], ustalar: [] })

beforeEach(() => {
  pending.getPendingQueue.mockReset().mockResolvedValue(queue(0))
  pending.listAdminOrders.mockReset().mockResolvedValue([{ id: 'o1' }, { id: 'o2' }])
})

describe('AdminCatalogPanel tabs', () => {
  it('opens Buyurtmalar when nothing waits for moderation', async () => {
    mount()
    expect(await screen.findByText('orders-panel')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Buyurtmalar/ })).toHaveAttribute('aria-selected', 'true')
    expect(pending.listAdminOrders).toHaveBeenCalledWith(expect.objectContaining({ status: 'accepted' }))
    await waitFor(() => expect(screen.getByRole('tab', { name: /Buyurtmalar/ })).toHaveTextContent('2'))
  })

  it('opens Moderatsiya when something is pending, with its count', async () => {
    pending.getPendingQueue.mockResolvedValue(queue(3))
    mount()
    expect(await screen.findByText('moderation-panel')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Moderatsiya/ })).toHaveTextContent('3')
  })

  it('?tab=products opens Tovarlar; an unknown tab falls back to the default', async () => {
    mount('/dokon?tab=products')
    expect(await screen.findByText('products-panel')).toBeInTheDocument()
    mount('/dokon?tab=bogus')
    expect(await screen.findByText('orders-panel')).toBeInTheDocument()
  })

  it('switching a tab writes ?tab=', async () => {
    mount()
    await screen.findByText('orders-panel')
    fireEvent.click(screen.getByRole('tab', { name: /Do'konlar/ }))
    expect(await screen.findByText('stores-panel')).toBeInTheDocument()
    expect(location.search).toBe('?tab=stores')
  })
})
