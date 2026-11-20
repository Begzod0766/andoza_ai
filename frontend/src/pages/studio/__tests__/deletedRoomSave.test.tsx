/**
 * A room deleted elsewhere while it is open in the studio (2026-11-19: a test kitchen went missing): the
 * autosave used to create it again, with a new id, in the same apartment, without a word. A room opened
 * from the server is not made again: the studio says it was deleted and stops saving.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor, act, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useRoomStore } from '@/store/roomStore'
import { ApiError } from '@/lib/api/client'

vi.mock('@/components/ui/ConfirmDialog', () => ({ useConfirm: () => vi.fn() }))
vi.mock('@/components/ui/Toast', () => ({ useToast: () => ({ toast: vi.fn() }), showToast: vi.fn() }))
vi.mock('@/components/studio/StudioMenu', async () => {
  const React = await import('react')
  return { StudioMenu: React.forwardRef(({ children }: { children: React.ReactNode }, _ref) => <div>{children}</div>) }
})
vi.mock('@/components/studio/RoomSettingsSheet', () => ({ default: () => null }))
vi.mock('@/components/studio/UnsavedChangesGuard', () => ({ UnsavedChangesGuard: () => null }))
vi.mock('@/hooks/useRestoreUserModels', () => ({ useRestoreUserModels: () => {} }))

const server = {
  id: 'A', apartment_id: 'apt', name: 'Oshxona', room_type: 'oshxona', state: { name: 'Oshxona' }, updated_at: '2026-11-19T10:00:00Z',
  length: 3.5, width: 3, ceiling_height: 2.7, area: 10.5,
}
let deleted = false
const getRoom = vi.fn(async () => structuredClone(server))
const updateRoom = vi.fn(async () => {
  if (deleted) throw new ApiError('{"detail":"Not found"}', 404)
  return structuredClone(server)
})
const createRoom = vi.fn(async () => ({ ...structuredClone(server), id: 'B' }))
const createApartment = vi.fn(async () => ({ id: 'apt2' }))
vi.mock('@/lib/api', async (orig) => ({
  ...(await orig<typeof import('@/lib/api')>()),
  getRoom: () => getRoom(),
  updateRoom: () => updateRoom(),
  createRoom: () => createRoom(),
  createApartment: () => createApartment(),
}))

import StudioPage from '../StudioPage'

beforeEach(() => {
  deleted = false
  vi.clearAllMocks()
  localStorage.clear()
  useRoomStore.getState().resetRoom()
})

describe('a room deleted while open in the studio', () => {
  it('is not created again: the studio says it was deleted', async () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={['/studio/A']}>
          <Routes><Route path="/studio/:roomId" element={<StudioPage />}><Route index element={<p>scene</p>} /></Route></Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )
    await waitFor(() => expect(useRoomStore.getState().roomId).toBe('A'))
    deleted = true
    act(() => useRoomStore.getState().setDesignState({ waterInlet: true }))
    await waitFor(() => expect(updateRoom).toHaveBeenCalled(), { timeout: 4000 })
    await waitFor(() => expect(screen.getByText(/o'chirilgan/i)).toBeInTheDocument(), { timeout: 4000 })
    expect(createRoom).not.toHaveBeenCalled()
    expect(createApartment).not.toHaveBeenCalled()
  }, 15_000)
})
