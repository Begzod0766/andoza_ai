import { describe, expect, it } from 'vitest'
import { untilReload } from '../untilReload'

describe('untilReload', () => {
  it('passes a loaded page through', async () => {
    const page = { default: () => null }
    expect(await untilReload(async () => page)()).toBe(page)
  })

  it('a chunk whose failure was taken over (vite:preloadError prevented: the page is about to reload) keeps loading', async () => {
    const p = untilReload(async () => undefined)()
    const r = await Promise.race([p.then(() => 'settled', () => 'failed'), new Promise((res) => setTimeout(() => res('pending'), 20))])
    expect(r).toBe('pending')
  })

  it('a failure nobody took over still fails', async () => {
    await expect(untilReload(async () => { throw new TypeError('Failed to fetch dynamically imported module') })()).rejects.toThrow()
  })
})
