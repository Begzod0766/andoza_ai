/**
 * Mobile QA 2026-11-18: a new kitchen from the app's wizard once opened at the finished room. If the
 * page bounces through /login, the way back must keep `?phase=` (and `?app=1`, `?lang=`): the guard
 * used to remember the path only.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router-dom'
import { RequireAuth } from '@/router'
import { useAuthStore } from '@/store/authStore'

function LoginStub() {
  const from = (useLocation().state as { from?: string } | null)?.from
  return <p>{`from=${from}`}</p>
}

describe('RequireAuth', () => {
  beforeEach(() => useAuthStore.setState({ isAuthenticated: false }))

  it('sends a guest to /login remembering the whole address, query and hash too', () => {
    const router = createMemoryRouter(
      [
        { path: '/login', element: <LoginStub /> },
        { path: '/studio/:roomId/ichkarida', element: <RequireAuth><p>studio</p></RequireAuth> },
      ],
      { initialEntries: ['/studio/r1/ichkarida?phase=quvurlar&app=1&lang=ru#x'] },
    )
    render(<RouterProvider router={router} />)
    expect(screen.getByText('from=/studio/r1/ichkarida?phase=quvurlar&app=1&lang=ru#x')).toBeInTheDocument()
  })
})
