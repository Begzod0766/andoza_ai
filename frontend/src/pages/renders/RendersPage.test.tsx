import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import RendersPage from './RendersPage'

const listAllRenders = vi.fn()
vi.mock('@/lib/api', async (orig) => ({
  ...(await orig<typeof import('@/lib/api')>()),
  listAllRenders: (...a: unknown[]) => listAllRenders(...a),
}))

const shot = (n: number, room: string | null = 'Mehmonxona') => ({
  id: `r${n}`, key: `renders/u/${n}.jpg`, url: `https://s3/${n}.jpg`, kind: 'render', lighting: null, prompt: null,
  panorama: false, parent_key: null, room_id: room ? `room-${n}` : null, room_name: room, created_at: '2026-11-07T10:00:00Z',
})

function renderPage() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter><RendersPage /></MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => listAllRenders.mockReset())

describe('Renderlarim: every room\'s renders in one place', () => {
  it('shows each render with its room name, newest first', async () => {
    listAllRenders.mockResolvedValueOnce({ items: [shot(1, 'Oshxona'), shot(2, null)], has_more: false })
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Renderlarim' })).toBeInTheDocument()
    expect(await screen.findAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByText('Oshxona')).toBeInTheDocument()
    expect(listAllRenders).toHaveBeenCalledWith(0, 24)
  })

  it('loads the next page on "show more", and hides the button on the last page', async () => {
    listAllRenders
      .mockResolvedValueOnce({ items: Array.from({ length: 24 }, (_, i) => shot(i)), has_more: true })
      .mockResolvedValueOnce({ items: [shot(100)], has_more: false })
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: "Ko'proq ko'rsatish" }))
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(25))
    expect(listAllRenders).toHaveBeenLastCalledWith(24, 24)
    expect(screen.queryByRole('button', { name: "Ko'proq ko'rsatish" })).toBeNull()
  })

  it('a tap opens the picture large, to download or to go to its room', async () => {
    listAllRenders.mockResolvedValueOnce({ items: [shot(7, 'Zal')], has_more: false })
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: /Zal/ }))
    const dialog = screen.getByRole('dialog')
    expect(dialog.querySelector('a[download]')).toHaveAttribute('href', 'https://s3/7.jpg')
    expect(screen.getByRole('link', { name: 'Xonaga o\'tish' })).toHaveAttribute('href', '/studio/room-7/ichkarida')
  })

  it('with no renders yet it says how to make one', async () => {
    listAllRenders.mockResolvedValueOnce({ items: [], has_more: false })
    renderPage()
    expect(await screen.findByText(/hali render yo'q/i)).toBeInTheDocument()
  })
})
