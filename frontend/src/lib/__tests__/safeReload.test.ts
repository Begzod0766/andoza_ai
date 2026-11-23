import { afterEach, describe, expect, it, vi } from 'vitest'
import { onBeforeReload, reloadSafely } from '../safeReload'

const offs: (() => void)[] = []
afterEach(() => { offs.splice(0).forEach((off) => off()) })

describe('reloadSafely', () => {
  it('reloads straight away when nothing has work to keep', async () => {
    const reload = vi.fn()
    expect(await reloadSafely({ reload })).toBe(true)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('waits for every page that has work to keep before it reloads', async () => {
    const order: string[] = []
    let finish!: () => void
    offs.push(onBeforeReload(() => new Promise<void>((r) => { finish = () => { order.push('saved'); r() } })))
    const reload = vi.fn(() => order.push('reload'))
    const p = reloadSafely({ reload })
    await Promise.resolve()
    expect(reload).not.toHaveBeenCalled()
    finish()
    expect(await p).toBe(true)
    expect(order).toEqual(['saved', 'reload'])
  })

  it('does not reload when the work could not be kept (a failed save), so nothing is lost', async () => {
    offs.push(onBeforeReload(async () => false))
    const reload = vi.fn()
    expect(await reloadSafely({ reload })).toBe(false)
    expect(reload).not.toHaveBeenCalled()
  })

  it('does not reload when keeping the work throws or never finishes', async () => {
    const off = onBeforeReload(() => { throw new Error('boom') })
    const reload = vi.fn()
    expect(await reloadSafely({ reload })).toBe(false)
    off()
    offs.push(onBeforeReload(() => new Promise(() => {})))
    expect(await reloadSafely({ reload, timeoutMs: 10 })).toBe(false)
    expect(reload).not.toHaveBeenCalled()
  })

  it('a page that went away no longer holds the reload up', async () => {
    const off = onBeforeReload(async () => false)
    off()
    const reload = vi.fn()
    expect(await reloadSafely({ reload })).toBe(true)
  })
})
