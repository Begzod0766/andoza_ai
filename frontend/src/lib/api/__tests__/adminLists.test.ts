import { describe, it, expect, vi, beforeEach } from 'vitest'

const client = vi.hoisted(() => ({ apiClient: vi.fn() }))
vi.mock('../client', () => client)

import { listAdminOrders } from '../adminOrders'
import { getCategoryCounts, listAdminFurniture } from '../admin'
import { listAdminMaterials } from '../adminMaterials'

beforeEach(() => client.apiClient.mockReset().mockResolvedValue([]))

describe('admin list api', () => {
  it('orders: sends every filter that is set', async () => {
    await listAdminOrders({ status: 'accepted', store_id: 's1', since: '2026-11-01T00:00:00.000Z', q: 'abc' })
    expect(client.apiClient).toHaveBeenCalledWith(
      '/admin/orders?page=1&per_page=50&status=accepted&store_id=s1&since=2026-11-01T00%3A00%3A00.000Z&q=abc',
    )
  })
  it('orders: no filters, a later page', async () => {
    await listAdminOrders({ page: 2 })
    expect(client.apiClient).toHaveBeenCalledWith('/admin/orders?page=2&per_page=50')
  })
  it('furniture: passes the search', async () => {
    await listAdminFurniture({ category: 'divan', q: 'oslo' })
    expect(client.apiClient).toHaveBeenCalledWith('/admin/furniture?category=divan&q=oslo')
  })
  it('materials: a page size reaches the server', async () => {
    client.apiClient.mockResolvedValue({ items: [], total: 0, page: 1, per_page: 50 })
    await listAdminMaterials({ page: 2, per_page: 50 })
    expect(client.apiClient).toHaveBeenCalledWith('/admin/materials?page=2&per_page=50')
  })
  it('category counts: shop and search, empty ones left out', async () => {
    await getCategoryCounts({ store_id: 's1', q: '' })
    expect(client.apiClient).toHaveBeenCalledWith('/admin/category-counts?store_id=s1')
    await getCategoryCounts()
    expect(client.apiClient).toHaveBeenLastCalledWith('/admin/category-counts')
  })
})
