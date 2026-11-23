import { describe, expect, it } from 'vitest'
import { PWA_WORKBOX } from '../../../pwaWorkbox'

/** The service worker must never hand out a cached page from an older deploy (mobile QA 2026-11-16:
 * the Studio opened on the old build until it was reopened). */
describe('PWA_WORKBOX', () => {
  it('the page is not precached, and navigations are not answered from the precache', () => {
    expect(PWA_WORKBOX.globPatterns!.some((p) => p.includes('html'))).toBe(false)
    expect(PWA_WORKBOX.navigateFallback).toBeNull()
  })

  it('a navigation goes to the network first, the cached page only when offline or slow', () => {
    const nav = PWA_WORKBOX.runtimeCaching!.find((r) => typeof r.urlPattern === 'function'
      && (r.urlPattern as (o: { request: { mode: string } }) => boolean)({ request: { mode: 'navigate' } }))
    expect(nav?.handler).toBe('NetworkFirst')
    expect(nav?.options?.networkTimeoutSeconds).toBeGreaterThan(0)
    expect((nav!.urlPattern as (o: { request: { mode: string } }) => boolean)({ request: { mode: 'cors' } })).toBe(false)
  })

  // Phone QA 2026-11-24 #12: a worker that took over at once reloaded the open studio by itself
  // (vite-plugin-pwa autoUpdate) and lost its undo history. A new one waits; the page decides
  // (lib/appUpdate). The page itself still comes from the network first, so the next open is new.
  it('a new deploy waits instead of taking over the open pages, and the old caches go once it does', () => {
    expect(PWA_WORKBOX.skipWaiting).toBe(false)
    expect(PWA_WORKBOX.cleanupOutdatedCaches).toBe(true)
  })
})
