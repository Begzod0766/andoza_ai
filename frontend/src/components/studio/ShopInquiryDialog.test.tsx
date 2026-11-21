import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ShopInquiryDialog } from './ShopInquiryDialog'
import { ApiError } from '@/lib/api/client'
import { asGuest, asRegistered, body403, inAppWithChannel, resetGuestMode } from '@/lib/__tests__/guestTestUtils'

const createShopInquiry = vi.hoisted(() => vi.fn())
vi.mock('@/lib/api', async (orig) => ({ ...(await orig<object>()), createShopInquiry: (...a: unknown[]) => createShopInquiry(...a) }))

const ROOM = '5b7661e0-ecd7-4c89-ba54-cb25902c0344'

function renderDialog(roomId: string | null = ROOM) {
  return render(
    <ShopInquiryDialog open onOpenChange={() => {}} storeId="s1" storeName="Hamkor Qurilish" furnitureId="m1" roomId={roomId} />,
    { wrapper: MemoryRouter },
  )
}

// Braces matter: an arrow that returns the mock makes vitest call it as the test's cleanup, which
// re-runs a rejecting mock outside any catch and fails the test with the rejection.
beforeEach(() => {
  createShopInquiry.mockReset()
})

describe('ShopInquiryDialog', () => {
  it('sends the model, the room and the message to the shop, then confirms', async () => {
    createShopInquiry.mockResolvedValue({ id: 'i1' })
    renderDialog()

    fireEvent.change(screen.getByLabelText(/Xabar/), { target: { value: '  Omborda bormi?  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Yuborish' }))

    await waitFor(() =>
      expect(createShopInquiry).toHaveBeenCalledWith('s1', { furniture_id: 'm1', room_id: ROOM, message: 'Omborda bormi?' }),
    )
    expect(await screen.findByText("Murojaatingiz yuborildi. Do'kon siz bilan bog'lanadi.")).toBeInTheDocument()
  })

  it('omits an empty message and a missing room', async () => {
    createShopInquiry.mockResolvedValue({ id: 'i1' })
    renderDialog(null)

    fireEvent.click(screen.getByRole('button', { name: 'Yuborish' }))

    await waitFor(() => expect(createShopInquiry).toHaveBeenCalledWith('s1', { furniture_id: 'm1' }))
  })

  it('leaves out a room whose id is not a server id (an unsaved draft)', async () => {
    createShopInquiry.mockResolvedValue({ id: 'i1' })
    renderDialog('draft-1')

    fireEvent.click(screen.getByRole('button', { name: 'Yuborish' }))

    await waitFor(() => expect(createShopInquiry).toHaveBeenCalledWith('s1', { furniture_id: 'm1' }))
  })

  it("shows the server's message when the daily limit is reached", async () => {
    createShopInquiry.mockRejectedValue(new Error('{"detail":"Bugun bu do\'konga murojaatlar limiti tugadi."}'))
    renderDialog()

    fireEvent.click(screen.getByRole('button', { name: 'Yuborish' }))

    expect(await screen.findByRole('alert')).toHaveTextContent("Bugun bu do'konga murojaatlar limiti tugadi.")
    expect(screen.queryByText(/Murojaatingiz yuborildi/)).toBeNull()
  })
})

describe('ShopInquiryDialog in guest mode', () => {
  afterEach(resetGuestMode)

  it('guest: contacting the shop asks for registration and sends nothing', () => {
    const post = inAppWithChannel()
    asGuest()
    renderDialog()
    fireEvent.click(screen.getByRole('button', { name: 'Yuborish' }))
    expect(post).toHaveBeenCalledWith('{"feature":"contact"}')
    expect(createShopInquiry).not.toHaveBeenCalled()
  })

  it('late 403 opens the prompt instead of the error text', async () => {
    const post = inAppWithChannel()
    asRegistered()
    createShopInquiry.mockRejectedValue(new ApiError(body403('contact'), 403))
    renderDialog()
    fireEvent.click(screen.getByRole('button', { name: 'Yuborish' }))
    await waitFor(() => expect(post).toHaveBeenCalledWith('{"feature":"contact"}'))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('registered user unchanged', async () => {
    const post = inAppWithChannel()
    asRegistered()
    createShopInquiry.mockResolvedValue({ id: 'i1' })
    renderDialog()
    fireEvent.click(screen.getByRole('button', { name: 'Yuborish' }))
    await waitFor(() => expect(createShopInquiry).toHaveBeenCalledTimes(1))
    expect(post).not.toHaveBeenCalled()
  })
})
