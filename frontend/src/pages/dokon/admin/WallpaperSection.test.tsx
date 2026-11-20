import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConfirmProvider } from '@/components/ui/ConfirmDialog'
import { WallpaperSection } from './WallpaperSection'

const api = vi.hoisted(() => ({ listAllWallpapers: vi.fn(), deleteWallpaper: vi.fn() }))
vi.mock('@/lib/api', async () => {
  const real = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return {
    ...real,
    listAllWallpapers: (...a: unknown[]) => api.listAllWallpapers(...a),
    deleteWallpaper: (...a: unknown[]) => api.deleteWallpaper(...a),
  }
})
vi.mock('./WallpaperEditDialog', () => ({ WallpaperEditDialog: () => null }))
vi.mock('./WallpaperFormDialog', () => ({ WallpaperFormDialog: () => null }))

const row = (over: Record<string, unknown>) => ({
  id: 'w', name: 'Oboy', kind: 'oboy', store_id: 's1', store_name: 'MAFF', price_uzs: 1000, description: null,
  width_cm: 53, height_cm: null, total_length_m: 10, url: 'https://x/w.jpg', content_type: 'image/jpeg',
  size_bytes: 1, created_at: '', status: 'approved', moderation_note: null, ...over,
})

function renderSection() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <ConfirmProvider>
        <WallpaperSection stores={[]} storeId="s1" onError={() => {}} />
      </ConfirmProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => Object.values(api).forEach((f) => f.mockReset()))

describe('admin wallpaper library', () => {
  it('lists every status through listAllWallpapers and badges each row', async () => {
    api.listAllWallpapers.mockResolvedValue([
      row({ id: 'a', name: 'Kutilayotgan', status: 'pending' }),
      row({ id: 'b', name: 'Tasdiqlangani', status: 'approved' }),
      row({ id: 'c', name: 'Rad qilingani', status: 'rejected', moderation_note: 'Xira' }),
      row({ id: 'd', name: 'Olib tashlangani', status: 'rejected', moderation_note: "Do'kon olib tashladi" }),
    ])
    renderSection()

    expect(await screen.findByText('Kutilayotgan')).toBeInTheDocument()
    expect(api.listAllWallpapers).toHaveBeenCalledWith({ store_id: 's1' })
    expect(screen.getByText("Ko'rib chiqilmoqda")).toBeInTheDocument()
    expect(screen.getByText('Tasdiqlangan')).toBeInTheDocument()
    expect(screen.getAllByText('Rad etilgan')).toHaveLength(1)
    expect(screen.getByText('Olib tashlangan')).toBeInTheDocument()
  })
})
