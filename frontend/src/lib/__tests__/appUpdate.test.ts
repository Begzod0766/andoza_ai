import { afterEach, describe, expect, it, vi } from 'vitest'
import { appUpdate, buildOf, entryScriptOf, inStudio, newVersionFound } from '../appUpdate'

afterEach(() => appUpdate.reset())

const PAGE = (hash: string) =>
  `<!doctype html><html><head><script type="module" crossorigin src="/assets/index-${hash}.js"></script></head></html>`

describe('which build a page runs', () => {
  it('reads the entry script out of index.html', () => {
    expect(entryScriptOf(PAGE('I_aIjOm1'))).toBe('/assets/index-I_aIjOm1.js')
    expect(entryScriptOf('<html><body><h1>Yangilanmoqda…</h1></body></html>')).toBeNull()
  })

  it('compares this page with the one the server hands out now', async () => {
    document.head.innerHTML = PAGE('LAcHfBIi').replace(/<\/?(html|head)>|<!doctype html>/g, '')
    const fetchNew = vi.fn(async () => new Response(PAGE('I_aIjOm1')))
    const fetchSame = vi.fn(async () => new Response(PAGE('LAcHfBIi')))
    const fetch502 = vi.fn(async () => new Response('<h1>Yangilanmoqda…</h1>', { status: 502 }))
    expect(await buildOf(fetchNew)).toBe('old')
    expect(await buildOf(fetchSame)).toBe('current')
    expect(await buildOf(fetch502)).toBe('unknown')
    expect(await buildOf(vi.fn(async () => { throw new TypeError('offline') }))).toBe('unknown')
    expect(fetchNew).toHaveBeenCalledWith('/', { cache: 'no-store' })
  })
})

describe('a new version found', () => {
  it('knows the studio by its address', () => {
    expect(inStudio('/studio/abc/ichkarida')).toBe(true)
    expect(inStudio('/projects')).toBe(false)
    expect(inStudio('/smeta/abc')).toBe(false)
  })

  it('outside the studio an old page takes it at once, as before', async () => {
    const apply = vi.fn()
    await newVersionFound(apply, { pathname: '/projects', build: async () => 'old' })
    expect(apply).toHaveBeenCalledTimes(1)
    expect(appUpdate.get()).toBe(false)
  })

  it('in the studio it never reloads by itself: it offers the update', async () => {
    const apply = vi.fn()
    await newVersionFound(apply, { pathname: '/studio/r1/ichkarida', build: async () => 'old' })
    expect(apply).not.toHaveBeenCalled()
    expect(appUpdate.get()).toBe(true)
    appUpdate.apply()
    expect(apply).toHaveBeenCalledTimes(1)
  })

  it('in the studio an unknown build is offered too, outside it nothing happens', async () => {
    const apply = vi.fn()
    await newVersionFound(apply, { pathname: '/projects', build: async () => 'unknown' })
    expect(apply).not.toHaveBeenCalled()
    await newVersionFound(apply, { pathname: '/studio/r1/ichkarida', build: async () => 'unknown' })
    expect(appUpdate.get()).toBe(true)
  })

  it('a page that already runs the new build is left alone (the worker takes over when the app closes)', async () => {
    const apply = vi.fn()
    for (const pathname of ['/projects', '/studio/r1/ichkarida']) {
      await newVersionFound(apply, { pathname, build: async () => 'current' })
    }
    expect(apply).not.toHaveBeenCalled()
    expect(appUpdate.get()).toBe(false)
  })
})
