import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConfirmProvider } from '@/components/ui/ConfirmDialog'
import { useRoomStore } from '@/store/roomStore'
import i18n from '@/i18n'

const api = vi.hoisted(() => ({ updateRoom: vi.fn() }))
vi.mock('@/lib/api', async (orig) => ({ ...(await orig<object>()), ...api }))

import { DiscardDesignMenuItem } from './DiscardDesignMenuItem'

function mount(onDone = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  render(<QueryClientProvider client={qc}><ConfirmProvider><DiscardDesignMenuItem roomId="r1" onDone={onDone} /></ConfirmProvider></QueryClientProvider>)
  return onDone
}

beforeEach(() => { vi.clearAllMocks(); api.updateRoom.mockResolvedValue({}) })

describe('DiscardDesignMenuItem', () => {
  it('asks first; cancelling keeps the design and sends nothing', async () => {
    const reset = vi.spyOn(useRoomStore.getState(), 'resetDesignState')
    mount()
    fireEvent.click(screen.getByRole('button', { name: i18n.t('studio.dizaynni_bekor_qilish') }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent(i18n.t('studio.dizayn_bekor_izoh'))
    fireEvent.click(within(dialog).getByRole('button', { name: i18n.t('common.bekor') }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(reset).not.toHaveBeenCalled()
    expect(api.updateRoom).not.toHaveBeenCalled()
  })

  it('on yes it resets the design and saves the room', async () => {
    const onDone = mount()
    fireEvent.click(screen.getByRole('button', { name: i18n.t('studio.dizaynni_bekor_qilish') }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: i18n.t('studio.dizaynni_bekor_qilish') }))
    await waitFor(() => expect(api.updateRoom).toHaveBeenCalledWith('r1', expect.objectContaining({ design_state: expect.any(Object) })))
    expect(onDone).toHaveBeenCalled()
  })
})

describe('the design panel', () => {
  it('no longer carries the discard button', () => {
    const src = readFileSync(join(__dirname, 'DesignPanel.tsx'), 'utf8')
    expect(src).not.toContain('studio.dizaynni_bekor_qilish')
  })
})
