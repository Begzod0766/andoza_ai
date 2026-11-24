import { beforeEach, describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/api/plumbingPrices', () => ({ getPlumbingPrices: vi.fn() }))

import { getPlumbingPrices } from '@/lib/api/plumbingPrices'
import { useRoomStore, UNDO_COALESCE_MS } from '../roomStore'
import type { PlumbingPrices } from '@/lib/pipeCost'

const st = () => useRoomStore.getState()
const mock = vi.mocked(getPlumbingPrices)
const PRICES = { pipes: {}, fittings: {} } as unknown as PlumbingPrices

beforeEach(() => {
  mock.mockReset()
  st().resetRoom()
  useRoomStore.setState({ roomId: 'r1' })
})

describe('plumbingPrices', () => {
  it('starts null', () => {
    expect(st().plumbingPrices).toBeNull()
  })

  it('load success sets the value', async () => {
    mock.mockResolvedValue(PRICES)
    await st().loadPlumbingPrices('r1')
    expect(mock).toHaveBeenCalledWith('r1')
    expect(st().plumbingPrices).toBe(PRICES)
  })

  it('failure leaves null and does not throw', async () => {
    mock.mockRejectedValue(new Error('boom'))
    await expect(st().loadPlumbingPrices('r1')).resolves.toBeUndefined()
    expect(st().plumbingPrices).toBeNull()
  })

  it('failure clears a previous value', async () => {
    mock.mockResolvedValueOnce(PRICES)
    await st().loadPlumbingPrices('r1')
    mock.mockRejectedValueOnce(new Error('boom'))
    await st().loadPlumbingPrices('r1')
    expect(st().plumbingPrices).toBeNull()
  })

  it('a late answer for another room is dropped', async () => {
    let resolve!: (p: PlumbingPrices) => void
    mock.mockReturnValue(new Promise((r) => { resolve = r }))
    const p = st().loadPlumbingPrices('r1')
    useRoomStore.setState({ roomId: 'r2' })
    resolve(PRICES)
    await p
    expect(st().plumbingPrices).toBeNull()
  })

  it('undo does not touch it', async () => {
    vi.useFakeTimers()
    try {
      mock.mockResolvedValue(PRICES)
      await st().loadPlumbingPrices('r1')
      vi.advanceTimersByTime(UNDO_COALESCE_MS + 50)
      useRoomStore.setState({ ceilingHeight: 3100 })
      useRoomStore.temporal.getState().undo()
      expect(st().plumbingPrices).toBe(PRICES)
      expect(useRoomStore.temporal.getState().pastStates.every((s) => !('plumbingPrices' in s))).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('is not persisted', async () => {
    mock.mockResolvedValue(PRICES)
    await st().loadPlumbingPrices('r1')
    const opts = useRoomStore.persist.getOptions()
    const saved = opts.partialize!(st()) as Record<string, unknown>
    expect('plumbingPrices' in saved).toBe(false)
  })

  it('resetRoom clears it', async () => {
    mock.mockResolvedValue(PRICES)
    await st().loadPlumbingPrices('r1')
    st().resetRoom()
    expect(st().plumbingPrices).toBeNull()
  })
})
