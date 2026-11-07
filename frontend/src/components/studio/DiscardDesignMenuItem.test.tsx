import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { FeedbackProvider } from '@/components/ui/FeedbackProvider'
import { useRoomStore } from '@/store/roomStore'
import i18n from '@/i18n'

const api = vi.hoisted(() => ({ updateRoom: vi.fn() }))
vi.mock('@/lib/api', async (orig) => ({ ...(await orig<object>()), ...api }))

import { DiscardDesignMenuItem } from './DiscardDesignMenuItem'

function mount(onDone = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  render(<QueryClientProvider client={qc}><FeedbackProvider><DiscardDesignMenuItem roomId="r1" onDone={onDone} /></FeedbackProvider></QueryClientProvider>)
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

describe('DiscardDesignMenuItem — menu', () => {
  it('closes the ⋮ menu before asking, so the dialog is not under it', async () => {
    const onDone = mount()
    fireEvent.click(screen.getByRole('button', { name: i18n.t('studio.dizaynni_bekor_qilish') }))
    expect(onDone).toHaveBeenCalled()
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it('reads red over the menu row\'s own ink colour', () => {
    mount()
    expect(screen.getByRole('button', { name: i18n.t('studio.dizaynni_bekor_qilish') }).className).toContain('!text-red-500')
  })
})

describe('DiscardDesignMenuItem — a save that fails', () => {
  it('says the reset is only on this device when the server does not take it', async () => {
    api.updateRoom.mockRejectedValue(new Error('offline'))
    mount()
    fireEvent.click(screen.getByRole('button', { name: i18n.t('studio.dizaynni_bekor_qilish') }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: i18n.t('studio.dizaynni_bekor_qilish') }))
    expect(await screen.findByText(i18n.t('studio.oflayn_saqlandi'))).toBeInTheDocument()
  })
})

describe('the design panel', () => {
  it('no longer carries the discard button', () => {
    const src = readFileSync(join(__dirname, 'DesignPanel.tsx'), 'utf8')
    expect(src).not.toContain('studio.dizaynni_bekor_qilish')
  })
})
