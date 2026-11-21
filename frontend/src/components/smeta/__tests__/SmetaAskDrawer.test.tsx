import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ApiError } from '@/lib/api/client'
import { SmetaAskDrawer } from '../SmetaAskDrawer'
import { asGuest, asRegistered, body403, inAppWithChannel, resetGuestMode } from '@/lib/__tests__/guestTestUtils'

const smetaAsk = vi.fn()
vi.mock('@/lib/api', () => ({ smetaAsk: (...a: unknown[]) => smetaAsk(...a) }))

function renderDrawer() {
  render(
    <MemoryRouter>
      <SmetaAskDrawer open onOpenChange={() => {}} roomId="room-1" />
    </MemoryRouter>,
  )
}

function ask(question = 'Arzonroq laminat bormi?') {
  fireEvent.change(screen.getByPlaceholderText("Masalan: Laminat o'rniga arzonroq variant bormi?"), {
    target: { value: question },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Yuborish' }))
}

beforeEach(() => {
  smetaAsk.mockReset()
  // jsdom has no scrolling; the drawer scrolls to its newest message.
  Element.prototype.scrollIntoView = vi.fn()
})
afterEach(resetGuestMode)

describe('SmetaAskDrawer in guest mode', () => {
  it('guest: a question asks for registration and sends nothing', async () => {
    const post = inAppWithChannel()
    asGuest()
    renderDrawer()
    ask()
    expect(post).toHaveBeenCalledWith('{"feature":"smeta_ask"}')
    expect(smetaAsk).not.toHaveBeenCalled()
  })

  it('guest: a suggested question asks for registration too', () => {
    const post = inAppWithChannel()
    asGuest()
    renderDrawer()
    fireEvent.click(screen.getByRole('button', { name: 'Arzonroq alternativ bormi?' }))
    expect(post).toHaveBeenCalledWith('{"feature":"smeta_ask"}')
    expect(smetaAsk).not.toHaveBeenCalled()
  })

  it('late 403 opens the prompt instead of the error text', async () => {
    const post = inAppWithChannel()
    asRegistered()
    smetaAsk.mockRejectedValue(new ApiError(body403('smeta_ask'), 403))
    renderDrawer()
    ask()
    await waitFor(() => expect(post).toHaveBeenCalledWith('{"feature":"smeta_ask"}'))
    expect(screen.queryByText(/registration_required/)).toBeNull()
  })

  it('registered user unchanged', async () => {
    const post = inAppWithChannel()
    asRegistered()
    smetaAsk.mockResolvedValue({ answer_uz: 'Ha, bor.', related_line_ids: [] })
    renderDrawer()
    ask()
    expect(await screen.findByText('Ha, bor.')).toBeInTheDocument()
    expect(smetaAsk).toHaveBeenCalledTimes(1)
    expect(post).not.toHaveBeenCalled()
  })

  it('another error still shows its text', async () => {
    const post = inAppWithChannel()
    asRegistered()
    smetaAsk.mockRejectedValue(new Error('Server band'))
    renderDrawer()
    ask()
    expect(await screen.findByText('Server band')).toBeInTheDocument()
    expect(post).not.toHaveBeenCalled()
  })
})
