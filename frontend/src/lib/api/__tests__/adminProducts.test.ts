import { describe, it, expect, vi, beforeEach } from 'vitest'

const client = vi.hoisted(() => ({ apiClient: vi.fn() }))
vi.mock('../client', () => client)

import { getProductsOverview, listAdminProducts } from '../adminProducts'
import { getAdminMaterial } from '../adminMaterials'
import { getAdminFurniture } from '../admin'

beforeEach(() => client.apiClient.mockReset().mockResolvedValue({}))

describe('admin products api', () => {
  it('lists one category with every filter, 25 a page by default', async () => {
    await listAdminProducts({ category: 'laminat', kind: 'materials', store_id: 's1', q: 'dub', status: 'hidden' })
    expect(client.apiClient).toHaveBeenCalledWith(
      '/admin/products?category=laminat&kind=materials&store_id=s1&q=dub&status=hidden&page=1&per_page=25',
    )
  })
  it('drops empty filters and sends the page', async () => {
    await listAdminProducts({ category: 'divan', q: '', page: 3, perPage: 10 })
    expect(client.apiClient).toHaveBeenCalledWith('/admin/products?category=divan&page=3&per_page=10')
  })
  it('overview with and without filters', async () => {
    await getProductsOverview({ status: 'active', q: '' })
    expect(client.apiClient).toHaveBeenCalledWith('/admin/products/overview?status=active')
    await getProductsOverview()
    expect(client.apiClient).toHaveBeenLastCalledWith('/admin/products/overview')
  })
  it('fetches one material and one model', async () => {
    await getAdminMaterial('m 1')
    expect(client.apiClient).toHaveBeenCalledWith('/admin/materials/m%201')
    await getAdminFurniture('f1')
    expect(client.apiClient).toHaveBeenLastCalledWith('/admin/furniture/f1')
  })
})
