import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor, act } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useRoomStore } from '@/store/roomStore'

vi.mock('@/components/ui/ConfirmDialog', () => ({ useConfirm: () => vi.fn() }))
vi.mock('@/components/ui/Toast', () => ({ useToast: () => ({ toast: vi.fn() }), showToast: vi.fn() }))
vi.mock('@/components/studio/StudioMenu', async () => {
  const React = await import('react')
  return { StudioMenu: React.forwardRef(({ children }: { children: React.ReactNode }, _ref) => <div>{children}</div>) }
})
vi.mock('@/components/studio/RoomSettingsSheet', () => ({ default: () => null }))
vi.mock('@/components/studio/UnsavedChangesGuard', () => ({ UnsavedChangesGuard: () => null }))
vi.mock('@/hooks/useRestoreUserModels', () => ({ useRestoreUserModels: () => {} }))

type ServerRoom = {
  id: string; apartment_id: string; name: string; room_type: string | null
  state: Record<string, unknown>; updated_at: string
  length: number; width: number; ceiling_height: number; area: number
}

let server: ServerRoom
let tick = 0
const stamp = () => `2026-11-14T10:00:${String(++tick).padStart(2, '0')}Z`

const getRoom = vi.fn(async () => structuredClone(server))
const updateRoom = vi.fn(async (_id: string, data: Record<string, unknown>) => {
  if (data.state) server.state = data.state as Record<string, unknown>
  server.updated_at = stamp()
  return structuredClone(server)
})
vi.mock('@/lib/api', async (orig) => ({
  ...(await orig<typeof import('@/lib/api')>()),
  getRoom: () => getRoom(),
  updateRoom: (id: string, data: Record<string, unknown>) => updateRoom(id, data),
}))

import StudioPage from '../StudioPage'

let go: (to: string) => void = () => {}
function Nav() {
  const navigate = useNavigate()
  go = navigate
  return null
}

/** The app's routes: the estimate is its own top-level page, so leaving for it unmounts the studio. */
function renderApp() {
  // As in main.tsx: a fetched room stays fresh for 5 minutes, so coming back reads the cache.
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: 5 * 60 * 1000, retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/studio/A']}>
        <Nav />
        <Routes>
          <Route path="/studio/:roomId" element={<StudioPage />}>
            <Route index element={<p>scene</p>} />
          </Route>
          <Route path="/smeta/:roomId" element={<p>smeta</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const savedInlet = () => (server.state.designState as { waterInlet?: boolean } | undefined)?.waterInlet

beforeEach(() => {
  tick = 0
  server = {
    id: 'A', apartment_id: 'apt', name: 'Hammom', room_type: 'hammom', state: { name: 'Hammom' }, updated_at: stamp(),
    length: 3, width: 2, ceiling_height: 2.7, area: 6,
  }
  getRoom.mockClear()
  updateRoom.mockClear()
  localStorage.clear()
  useRoomStore.getState().resetRoom()
})

describe('coming back to the studio from the estimate', () => {
  it('keeps the edits saved before leaving, and the next edit does not save the room as it was at first', async () => {
    renderApp()
    await waitFor(() => expect(useRoomStore.getState().roomId).toBe('A'))

    act(() => useRoomStore.getState().setDesignState({ waterInlet: true }))
    await waitFor(() => expect(savedInlet()).toBe(true), { timeout: 4000 })
    await waitFor(() => expect(useRoomStore.getState().isDirty).toBe(false))

    act(() => go('/smeta/A'))
    act(() => go('/studio/A'))
    await new Promise((r) => setTimeout(r, 50))
    expect(useRoomStore.getState().designState.waterInlet).toBe(true)

    act(() => useRoomStore.getState().setDesignState({ ventFan: false }))
    await waitFor(() => expect((server.state.designState as { ventFan?: boolean }).ventFan).toBe(false), { timeout: 4000 })
    expect(savedInlet()).toBe(true)
  }, 15_000)
})
