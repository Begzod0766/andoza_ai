import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useRoomStore } from '@/store/roomStore'
import { RoomTypePicker } from './RoomTypePicker'

const updateRoom = vi.fn()
vi.mock('@/lib/api', () => ({ updateRoom: (...a: unknown[]) => updateRoom(...a) }))
vi.mock('@/components/ui/Toast', () => ({ showToast: vi.fn() }))

beforeEach(() => {
  updateRoom.mockReset()
  updateRoom.mockResolvedValue({})
  localStorage.clear()
  useRoomStore.getState().resetRoom()
})

describe('RoomTypePicker and the room it belongs to', () => {
  it("does not PATCH a room the store does not hold (another room's type is on show)", () => {
    // The AI sheet passes the URL's room; the store still holds the room just left.
    useRoomStore.setState({ roomId: 'A', roomType: 'oshxona', name: 'Mening xonam' })
    render(<RoomTypePicker roomId="B" />)
    const select = screen.getByLabelText('Xona turi') as HTMLSelectElement
    expect(select).toBeDisabled()
    fireEvent.change(select, { target: { value: 'hammom' } })
    expect(updateRoom).not.toHaveBeenCalledWith('B', expect.anything())
    expect(useRoomStore.getState().roomType).toBe('oshxona')
  })

  it('a failed PATCH for the room left behind does not put its old type on the room opened since', async () => {
    let fail: (e: Error) => void = () => {}
    updateRoom.mockImplementationOnce(() => new Promise((_res, rej) => { fail = rej }))
    useRoomStore.getState().loadRoom({ id: 'A', name: 'Mening xonam', room_type: 'mehmonxona' })
    render(<RoomTypePicker roomId="A" />)
    fireEvent.change(screen.getByLabelText('Xona turi'), { target: { value: 'oshxona' } })
    expect(updateRoom).toHaveBeenCalledWith('A', { room_type: 'oshxona' })

    // The user switches to room B, whose own type happens to be the one just picked for A.
    act(() => useRoomStore.getState().loadRoom({ id: 'B', name: 'Mening xonam', room_type: 'oshxona' }))
    await act(async () => { fail(new Error('HTTP 500')) })
    await waitFor(() => expect(updateRoom).toHaveBeenCalledTimes(1))
    expect(useRoomStore.getState().roomId).toBe('B')
    expect(useRoomStore.getState().roomType).toBe('oshxona')
  })

  it('with preselectGuess, a room of no type shows the guess picked, marked as a guess, and saves nothing', () => {
    useRoomStore.getState().loadRoom({ id: 'A', name: 'Mehmonxona', room_type: null })
    render(<RoomTypePicker roomId="A" preselectGuess />)
    const select = screen.getByLabelText('Xona turi') as HTMLSelectElement
    expect(select.value).toBe('mehmonxona')
    expect(screen.getByText(/xona nomidan taxmin qilindi/i)).toBeInTheDocument()
    expect(updateRoom).not.toHaveBeenCalled()
    expect(useRoomStore.getState().roomType).toBeNull()
  })

  it('with preselectGuess, picking another type saves it and drops the guess mark', async () => {
    useRoomStore.getState().loadRoom({ id: 'A', name: 'Mehmonxona', room_type: null })
    render(<RoomTypePicker roomId="A" preselectGuess />)
    fireEvent.change(screen.getByLabelText('Xona turi'), { target: { value: 'yotoqxona' } })
    expect(updateRoom).toHaveBeenCalledWith('A', { room_type: 'yotoqxona' })
    expect((screen.getByLabelText('Xona turi') as HTMLSelectElement).value).toBe('yotoqxona')
    expect(screen.queryByText(/xona nomidan taxmin qilindi/i)).toBeNull()
  })

  it('without preselectGuess, a room of no type still shows "not set" with the guess below', () => {
    useRoomStore.getState().loadRoom({ id: 'A', name: 'Mehmonxona', room_type: null })
    render(<RoomTypePicker roomId="A" />)
    expect((screen.getByLabelText('Xona turi') as HTMLSelectElement).value).toBe('')
  })

  it("a saved pick refreshes the room's copy and the apartment's room list", async () => {
    const qc = new QueryClient()
    const spy = vi.spyOn(qc, 'invalidateQueries')
    useRoomStore.getState().loadRoom({ id: 'A', name: 'Mening xonam', room_type: 'mehmonxona' })
    render(<QueryClientProvider client={qc}><RoomTypePicker roomId="A" /></QueryClientProvider>)
    fireEvent.change(screen.getByLabelText('Xona turi'), { target: { value: 'oshxona' } })
    await waitFor(() => expect(spy).toHaveBeenCalledWith({ queryKey: ['apt-rooms'] }))
    expect(spy).toHaveBeenCalledWith({ queryKey: ['room', 'A'] })
  })
})
