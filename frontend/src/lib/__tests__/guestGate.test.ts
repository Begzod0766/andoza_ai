import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderHook } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ApiError } from '@/lib/api/client'
import type { AuthUser } from '@/lib/api/auth'
import { useAuthStore } from '@/store/authStore'
import { isEmbeddedApp } from '@/lib/embedded'
import {
  isGuest,
  registrationRequiredFeature,
  requestRegistration,
  useGuestGate,
} from '@/lib/guestGate'

const u: AuthUser = {
  id: 'u1',
  phone: null,
  username: 'ali',
  name: null,
  created_at: '2026-11-20T00:00:00Z',
}

function setUser(extra: Partial<AuthUser>) {
  useAuthStore.setState({ user: { ...u, ...extra }, isAuthenticated: true })
}

const body = JSON.stringify({
  detail: { code: 'registration_required', feature: 'render', message: 'x' },
})

let nav: ReturnType<typeof vi.fn>

const inRouter = ({ children }: { children: ReactNode }) => createElement(MemoryRouter, null, children)

beforeEach(() => {
  nav = vi.fn()
  sessionStorage.clear()
  delete window.AndozaAuthGate
  history.replaceState(null, '', '/')
})

afterEach(() => {
  delete window.AndozaAuthGate
  useAuthStore.setState({ user: null, isAuthenticated: false })
})

describe('registrationRequiredFeature', () => {
  it('recognises the ApiError 403', () => {
    expect(registrationRequiredFeature(new ApiError(body, 403))).toBe('render')
  })

  it('recognises the 403 inside a plain Error', () => {
    expect(registrationRequiredFeature(new Error(body))).toBe('render')
  })

  it('ignores other 403s', () => {
    expect(
      registrationRequiredFeature(
        new ApiError('{"detail":"Faqat sotuvchi va administrator uchun"}', 403),
      ),
    ).toBeNull()
    expect(registrationRequiredFeature(new Error('not json'))).toBeNull()
    expect(registrationRequiredFeature(null)).toBeNull()
    expect(registrationRequiredFeature('x')).toBeNull()
  })

  it('ignores an unknown feature name', () => {
    const odd = JSON.stringify({ detail: { code: 'registration_required', feature: 'zzz' } })
    expect(registrationRequiredFeature(new ApiError(odd, 403))).toBeNull()
  })
})

describe('isGuest', () => {
  it('isGuest only on true', () => {
    setUser({ is_guest: true })
    expect(isGuest()).toBe(true)
    setUser({})
    expect(isGuest()).toBe(false)
    useAuthStore.setState({ user: null, isAuthenticated: false })
    expect(isGuest()).toBe(false)
  })

  it('setAuthenticated replaces is_guest', () => {
    useAuthStore.getState().setAuthenticated({ ...u, is_guest: true })
    expect(isGuest()).toBe(true)
    useAuthStore.getState().setAuthenticated({ ...u, is_guest: false })
    expect(isGuest()).toBe(false)
  })
})

describe('requestRegistration', () => {
  it('posts to the channel when embedded', () => {
    const post = vi.fn()
    window.AndozaAuthGate = { postMessage: post }
    history.replaceState(null, '', '/studio/r?app=1')
    requestRegistration('render', nav)
    expect(post).toHaveBeenCalledWith('{"feature":"render"}')
    expect(nav).not.toHaveBeenCalled()
  })

  it('uses the channel after ?app=1 is gone', () => {
    const post = vi.fn()
    window.AndozaAuthGate = { postMessage: post }
    isEmbeddedApp('?app=1')
    history.replaceState(null, '', '/smeta/r')
    requestRegistration('market_prices', nav)
    expect(post).toHaveBeenCalledWith('{"feature":"market_prices"}')
    expect(nav).not.toHaveBeenCalled()
  })

  it('goes to /login on the website', () => {
    history.replaceState(null, '', '/smeta/r?x=1')
    requestRegistration('market_prices', nav)
    expect(nav).toHaveBeenCalledWith('/login', { state: { from: '/smeta/r?x=1' } })
  })

  it('goes to /login in an old app build without the channel', () => {
    history.replaceState(null, '', '/studio/r?app=1')
    requestRegistration('render', nav)
    expect(nav).toHaveBeenCalledWith('/login', { state: { from: '/studio/r?app=1' } })
  })

  it('does not post to the channel on the plain website', () => {
    const post = vi.fn()
    window.AndozaAuthGate = { postMessage: post }
    history.replaceState(null, '', '/smeta/r')
    requestRegistration('render', nav)
    expect(post).not.toHaveBeenCalled()
    expect(nav).toHaveBeenCalled()
  })
})

describe('useGuestGate', () => {
  it('prompts a guest and tells the caller to stop', () => {
    const post = vi.fn()
    window.AndozaAuthGate = { postMessage: post }
    isEmbeddedApp('?app=1')
    setUser({ is_guest: true })
    const { result } = renderHook(() => useGuestGate(), { wrapper: inRouter })
    expect(result.current.guest).toBe(true)
    expect(result.current.gate('render')).toBe(true)
    expect(post).toHaveBeenCalledWith('{"feature":"render"}')
  })

  it('lets a registered user through', () => {
    const post = vi.fn()
    window.AndozaAuthGate = { postMessage: post }
    isEmbeddedApp('?app=1')
    setUser({})
    const { result } = renderHook(() => useGuestGate(), { wrapper: inRouter })
    expect(result.current.guest).toBe(false)
    expect(result.current.gate('render')).toBe(false)
    expect(post).not.toHaveBeenCalled()
  })
})
