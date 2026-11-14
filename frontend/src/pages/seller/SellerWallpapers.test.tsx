import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FeedbackProvider } from '@/components/ui/FeedbackProvider'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ApiError } from '@/lib/api/client'
import { SellerWallpapers } from './SellerWallpapers'

const api = vi.hoisted(() => ({
  listMyWallpapers: vi.fn(),
  uploadMyWallpaper: vi.fn(),
  updateMyWallpaper: vi.fn(),
  deleteMyWallpaper: vi.fn(),
}))
vi.mock('@/lib/api', () => ({
  ...Object.fromEntries(Object.entries(api).map(([k, v]) => [k, (...a: unknown[]) => v(...a)])),
}))

const wp = (over: Record<string, unknown> = {}) => ({
  id: 'w1', name: 'Klassik gul', kind: 'oboy', store_id: 's1', store_name: 'Mebel Plus',
  price_uzs: 120000, description: null, width_cm: 106, height_cm: null, total_length_m: 10,
  url: 'http://x/w.jpg', content_type: 'image/jpeg', size_bytes: 1, created_at: '2026-11-15',
  status: 'approved', moderation_note: null, ...over,
})

function renderIt(props: { openNew?: boolean; onOpenNewChange?: (o: boolean) => void } = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <FeedbackProvider><SellerWallpapers openNew={props.openNew ?? false} onOpenNewChange={props.onOpenNewChange ?? (() => {})} /></FeedbackProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => Object.values(api).forEach((f) => f.mockReset()))

describe('SellerWallpapers', () => {
  it('lists name, roll price, size, status and the rejection reason', async () => {
    api.listMyWallpapers.mockResolvedValue([
      wp(),
      wp({ id: 'w2', name: 'Rad', status: 'rejected', moderation_note: 'Rasm xira' }),
    ])
    renderIt()
    expect(await screen.findByText('Klassik gul')).toBeInTheDocument()
    expect(screen.getAllByText("1 rulon: 120 000 so'm").length).toBe(2)
    expect(screen.getAllByText('106 sm × 10 m').length).toBe(2)
    expect(screen.getByText('Tasdiqlangan')).toBeInTheDocument()
    expect(screen.getByText(/Rasm xira/)).toBeInTheDocument()
  })

  it('keeps Save disabled until every field is filled, then uploads', async () => {
    api.listMyWallpapers.mockResolvedValue([])
    api.uploadMyWallpaper.mockResolvedValue(wp({ status: 'pending' }))
    renderIt({ openNew: true })
    const save = await screen.findByRole('button', { name: 'Saqlash' })
    expect(save).toBeDisabled()
    const file = new File(['x'], 'a.png', { type: 'image/png' })
    fireEvent.change(screen.getByLabelText('Rasm'), { target: { files: [file] } })
    fireEvent.change(screen.getByLabelText('Nomi'), { target: { value: ' Gul ' } })
    fireEvent.change(screen.getByLabelText("1 rulon narxi (so'm)"), { target: { value: '120000' } })
    fireEvent.change(screen.getByLabelText('Eni (sm)'), { target: { value: '106' } })
    expect(save).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Rulon uzunligi (m)'), { target: { value: '10' } })
    expect(save).toBeEnabled()
    fireEvent.click(save)
    await waitFor(() => expect(api.uploadMyWallpaper).toHaveBeenCalledWith({ file, name: 'Gul', priceUzs: 120000, widthCm: 106, totalLengthM: 10 }))
    expect(await screen.findByText("Admin tasdiqlagach Studio'da ko'rinadi.")).toBeInTheDocument()
  })

  it('offers the image field only for pending or rejected wallpapers', async () => {
    api.listMyWallpapers.mockResolvedValue([wp({ id: 'a', name: 'Appr' }), wp({ id: 'p', name: 'Pend', status: 'pending' })])
    renderIt()
    fireEvent.click((await screen.findAllByRole('button', { name: 'Tahrirlash' }))[0])
    expect(await screen.findByLabelText('Nomi')).toHaveValue('Appr')
    expect(screen.queryByLabelText('Rasm')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Bekor qilish' }))
    await waitFor(() => expect(screen.queryByLabelText('Nomi')).not.toBeInTheDocument())
    fireEvent.click(screen.getAllByRole('button', { name: 'Tahrirlash' })[1])
    expect(await screen.findByLabelText('Rasm')).toBeInTheDocument()
  })

  it('shows the 409 message from the server', async () => {
    api.listMyWallpapers.mockResolvedValue([])
    api.uploadMyWallpaper.mockRejectedValue(new ApiError(JSON.stringify({ detail: "Bu oboy ro'yxatingizda bor, uni tahrirlang" }), 409))
    renderIt({ openNew: true })
    fireEvent.change(await screen.findByLabelText('Rasm'), { target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] } })
    fireEvent.change(screen.getByLabelText('Nomi'), { target: { value: 'Gul' } })
    fireEvent.change(screen.getByLabelText("1 rulon narxi (so'm)"), { target: { value: '1000' } })
    fireEvent.change(screen.getByLabelText('Eni (sm)'), { target: { value: '106' } })
    fireEvent.change(screen.getByLabelText('Rulon uzunligi (m)'), { target: { value: '10' } })
    fireEvent.click(screen.getByRole('button', { name: 'Saqlash' }))
    expect(await screen.findByText("Bu oboy ro'yxatingizda bor, uni tahrirlang")).toBeInTheDocument()
  })

  const removed = () => wp({ id: 'r1', name: 'Olingan', status: 'rejected', moderation_note: "Do'kon olib tashladi" })

  it('shows a shop-removed row as removed, not rejected, and restores it by saving it as it is', async () => {
    api.listMyWallpapers.mockResolvedValue([removed()])
    api.updateMyWallpaper.mockResolvedValue(wp())
    renderIt()
    expect(await screen.findByText('Olib tashlangan')).toBeInTheDocument()
    expect(screen.queryByText('Rad etildi')).toBeNull()
    expect(screen.queryByText(/Sabab/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Qaytarish' }))
    await waitFor(() => expect(api.updateMyWallpaper).toHaveBeenCalledWith('r1', { name: 'Olingan' }))
  })

  it('keeps Save disabled for a width or length outside the allowed range', async () => {
    api.listMyWallpapers.mockResolvedValue([])
    renderIt({ openNew: true })
    fireEvent.change(await screen.findByLabelText('Rasm'), { target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] } })
    fireEvent.change(screen.getByLabelText('Nomi'), { target: { value: 'Gul' } })
    fireEvent.change(screen.getByLabelText("1 rulon narxi (so'm)"), { target: { value: '1000' } })
    fireEvent.change(screen.getByLabelText('Rulon uzunligi (m)'), { target: { value: '10' } })
    const save = screen.getByRole('button', { name: 'Saqlash' })
    fireEvent.change(screen.getByLabelText('Eni (sm)'), { target: { value: '20' } })
    expect(save).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Eni (sm)'), { target: { value: '106.5' } })
    expect(save).toBeEnabled()
    fireEvent.change(screen.getByLabelText('Rulon uzunligi (m)'), { target: { value: '51' } })
    expect(save).toBeDisabled()
  })

  it('offers no edit button on a shop-removed row, only Qaytarish', async () => {
    api.listMyWallpapers.mockResolvedValue([removed(), wp({ id: 'a', name: 'Appr' })])
    renderIt()
    await screen.findByText('Olingan')
    expect(screen.getAllByRole('button', { name: 'Tahrirlash' })).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Qaytarish' })).toBeInTheDocument()
  })

  it('keeps Save disabled for a fractional price', async () => {
    api.listMyWallpapers.mockResolvedValue([])
    renderIt({ openNew: true })
    fireEvent.change(await screen.findByLabelText('Rasm'), { target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] } })
    fireEvent.change(screen.getByLabelText('Nomi'), { target: { value: 'Gul' } })
    fireEvent.change(screen.getByLabelText('Eni (sm)'), { target: { value: '106' } })
    fireEvent.change(screen.getByLabelText('Rulon uzunligi (m)'), { target: { value: '10' } })
    const save = screen.getByRole('button', { name: 'Saqlash' })
    fireEvent.change(screen.getByLabelText("1 rulon narxi (so'm)"), { target: { value: '120000.5' } })
    expect(save).toBeDisabled()
    fireEvent.change(screen.getByLabelText("1 rulon narxi (so'm)"), { target: { value: '120000' } })
    expect(save).toBeEnabled()
  })

  it('tells the owner a rejected wallpaper is back in review after editing it', async () => {
    api.listMyWallpapers.mockResolvedValue([wp({ id: 'x', name: 'Rad', status: 'rejected', moderation_note: 'Xira' })])
    api.updateMyWallpaper.mockResolvedValue(wp({ status: 'pending' }))
    renderIt()
    fireEvent.click(await screen.findByRole('button', { name: 'Tahrirlash' }))
    fireEvent.change(await screen.findByLabelText('Nomi'), { target: { value: 'Yangi' } })
    fireEvent.click(screen.getByRole('button', { name: 'Saqlash' }))
    await waitFor(() => expect(api.updateMyWallpaper).toHaveBeenCalled())
    expect(await screen.findByText("Admin tasdiqlagach Studio'da ko'rinadi.")).toBeInTheDocument()
  })

  it('closes silently after editing an approved wallpaper', async () => {
    api.listMyWallpapers.mockResolvedValue([wp()])
    api.updateMyWallpaper.mockResolvedValue(wp())
    renderIt()
    fireEvent.click(await screen.findByRole('button', { name: 'Tahrirlash' }))
    fireEvent.change(await screen.findByLabelText('Nomi'), { target: { value: 'Yangi' } })
    fireEvent.click(screen.getByRole('button', { name: 'Saqlash' }))
    await waitFor(() => expect(screen.queryByLabelText('Nomi')).not.toBeInTheDocument())
    expect(screen.queryByText("Admin tasdiqlagach Studio'da ko'rinadi.")).toBeNull()
  })
})
