import { describe, it, expect, vi, beforeEach } from 'vitest'

const client = vi.hoisted(() => ({ apiClient: vi.fn() }))
vi.mock('../client', () => client)

import { listMyWallpapers, uploadMyWallpaper, updateMyWallpaper, deleteMyWallpaper } from '../seller'
import { listAllWallpapers } from '../wallpapers'

const call = () => client.apiClient.mock.calls[0]
const form = () => call()[1].body as FormData

beforeEach(() => client.apiClient.mockReset().mockResolvedValue([]))

describe('seller wallpapers', () => {
  it('lists the shop wallpapers', async () => {
    await listMyWallpapers()
    expect(call()[0]).toBe('/seller/wallpapers')
  })

  it('uploads multipart fields', async () => {
    const file = new File(['x'], 'a.png')
    await uploadMyWallpaper({ file, name: 'Gul', priceUzs: 90000, widthCm: 53, totalLengthM: 10 })
    expect(call()[0]).toBe('/seller/wallpapers')
    expect(call()[1].method).toBe('POST')
    const f = form()
    expect(f.get('file')).toBeInstanceOf(File)
    expect(f.get('name')).toBe('Gul')
    expect(f.get('price_uzs')).toBe('90000')
    expect(f.get('width_cm')).toBe('53')
    expect(f.get('total_length_m')).toBe('10')
  })

  it('patches only the given fields', async () => {
    await updateMyWallpaper('w1', { name: 'Yangi', priceUzs: 0 })
    expect(call()[0]).toBe('/seller/wallpapers/w1')
    expect(call()[1].method).toBe('PATCH')
    const f = form()
    expect(f.get('name')).toBe('Yangi')
    expect(f.get('price_uzs')).toBe('0')
    expect(f.has('file')).toBe(false)
    expect(f.has('width_cm')).toBe(false)
    expect(f.has('total_length_m')).toBe(false)
  })

  it('deletes', async () => {
    await deleteMyWallpaper('w1')
    expect(call()[0]).toBe('/seller/wallpapers/w1')
    expect(call()[1].method).toBe('DELETE')
  })
})

describe('listAllWallpapers', () => {
  it('calls /wallpapers/all', async () => {
    await listAllWallpapers({ kind: 'oboy' })
    expect(call()[0]).toMatch(/^\/wallpapers\/all\?/)
    expect(call()[0]).toContain('kind=oboy')
  })
})
