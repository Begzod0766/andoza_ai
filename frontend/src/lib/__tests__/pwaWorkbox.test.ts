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

  it('a new deploy still takes over at once, and the old caches go', () => {
    expect([PWA_WORKBOX.skipWaiting, PWA_WORKBOX.clientsClaim, PWA_WORKBOX.cleanupOutdatedCaches]).toEqual([true, true, true])
  })
})
