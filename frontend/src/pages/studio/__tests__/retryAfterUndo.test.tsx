import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor, act, screen, fireEvent } from '@testing-library/react'
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

/**
 * QA #380 (2026-11-22): a drag failed to save, was undone, and "Qayta urinish" seemed to put it back. The
 * retry saves the room as it is NOW, the undo included; what put the drag back was a tap on "oldinga"
 * (redo), moved under the finger by the save status (now off the row: SaveStatus).
 */
describe('"Qayta urinish" after an undo', () => {
  it('saves the room as it is now, not the edit that failed to save', async () => {
    renderApp()
    await waitFor(() => expect(useRoomStore.getState().roomId).toBe('A'))
    await new Promise((r) => setTimeout(r, 450))

    updateRoom.mockRejectedValueOnce(new Error('network'))
    act(() => useRoomStore.getState().setDesignState({ waterInlet: true }))
    const retry = await screen.findByRole('button', { name: /qayta.urinish/i }, { timeout: 4000 })

    act(() => useRoomStore.temporal.getState().undo())
    expect(useRoomStore.getState().designState.waterInlet).not.toBe(true)
    fireEvent.click(retry)
    await waitFor(() => expect(updateRoom).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.queryByRole('button', { name: /qayta.urinish/i })).toBeNull())
    expect(savedInlet()).not.toBe(true)
    expect(useRoomStore.getState().designState.waterInlet).not.toBe(true)
  }, 15_000)
})
