/**
 * QA 2026-11-05 #15: the ⋮ menu's "Delete" removes the whole room (after a
 * confirm), but with a model selected it reads as "delete this model". The
 * row has to say what it deletes.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { applyLanguage } from '@/i18n'

vi.mock('@/components/ui/ConfirmDialog', () => ({ useConfirm: () => vi.fn().mockResolvedValue(false) }))
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
}))

import StudioPage from '../StudioPage'

afterEach(() => act(() => applyLanguage('uz')))

function renderPage() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/studio/r1']}>
        <Routes><Route path="/studio/:roomId" element={<StudioPage />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('the ⋮ menu names what it deletes (QA #15)', () => {
  it.each([
    ['en', 'Delete room'],
    ['ru', 'Удалить комнату'],
    ['uz', "Xonani o'chirish"],
  ])('%s: "%s", not a bare "Delete"', async (lng, label) => {
    act(() => applyLanguage(lng as 'uz'))
    renderPage()
    expect(await screen.findByRole('button', { name: label })).toBeInTheDocument()
  })
})
