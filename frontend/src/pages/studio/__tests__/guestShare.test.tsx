import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as api from '@/lib/api'
import { asGuest, inAppWithChannel, resetGuestMode } from '@/lib/__tests__/guestTestUtils'

const confirm = vi.hoisted(() => vi.fn().mockResolvedValue(false))
// A room's share link stays open to a guest of the app (spec §8.3: it helps the app grow).

vi.mock('@/components/ui/ConfirmDialog', () => ({ useConfirm: () => confirm }))
vi.mock('@/components/ui/Toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@/components/studio/StudioMenu', async () => {
  const React = await import('react')
  return { StudioMenu: React.forwardRef(({ children }: { children: React.ReactNode }, _ref) => <div>{children}</div>) }
})
vi.mock('@/components/studio/RoomSettingsSheet', () => ({ default: () => null }))
vi.mock('@/components/studio/UnsavedChangesGuard', () => ({ UnsavedChangesGuard: () => null }))
vi.mock('@/hooks/useRestoreUserModels', () => ({ useRestoreUserModels: () => {} }))
vi.mock('@/lib/api', async (orig) => ({
  ...(await orig<typeof import('@/lib/api')>()),
  getRoom: vi.fn().mockResolvedValue({ id: 'r1', apartment_id: 'a1', name: 'Zal', length: 4, width: 3, ceiling_height: 2.7, area: 12 }),
  createShareLink: vi.fn().mockResolvedValue({ share_token: 'tok' }),
  revokeShareLink: vi.fn(),
}))

import StudioPage from '../StudioPage'

afterEach(resetGuestMode)

describe('sharing a room in guest mode', () => {
  it('guest can still share a room', async () => {
    const post = inAppWithChannel()
    asGuest()
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={['/studio/r1']}>
          <Routes><Route path="/studio/:roomId" element={<StudioPage />} /></Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Ulashish' }))
    await waitFor(() => expect(api.createShareLink).toHaveBeenCalledWith('r1'))
    expect(post).not.toHaveBeenCalled()
  })
})
