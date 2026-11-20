import { vi } from 'vitest'
import { useAuthStore } from '@/store/authStore'
import { isEmbeddedApp } from '@/lib/embedded'
import type { GuestFeature } from '@/lib/guestGate'

/** Test helpers for guest mode: a guest or registered user, inside the app with its channel. */

const USER = { id: 'u1', phone: null, username: null, name: null, created_at: '2026-11-20T00:00:00Z' }

export function asGuest() {
  useAuthStore.setState({ user: { ...USER, is_guest: true }, isAuthenticated: true })
}

export function asRegistered() {
  useAuthStore.setState({ user: { ...USER, username: 'ali', is_guest: false }, isAuthenticated: true })
}

/** Inside the app's WebView (remembered for the session, as after `?app=1`), with the sign-up channel. */
export function inAppWithChannel() {
  const post = vi.fn()
  isEmbeddedApp('?app=1')
  window.AndozaAuthGate = { postMessage: post }
  return post
}

export function resetGuestMode() {
  delete window.AndozaAuthGate
  sessionStorage.clear()
  useAuthStore.setState({ user: null, isAuthenticated: false })
}

/** The backend's guest 403 body, as `ApiError.message` / the AI stream's `Error.message` carry it. */
export function body403(feature: GuestFeature) {
  return JSON.stringify({ detail: { code: 'registration_required', feature, message: "Ro'yxatdan o'ting" } })
}
