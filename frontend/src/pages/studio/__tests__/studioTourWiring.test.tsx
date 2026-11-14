import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, act, renderHook } from '@testing-library/react'
import { useEffect } from 'react'
import { MemoryRouter, Route, Routes, useOutletContext } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import i18n from '@/i18n'
import type { StudioContext } from '../ThreeDPage'
import { STUDIO_TOUR_KEY } from '@/lib/studioTour'
import { studioTourReady, useStudioTourWiring } from '../three-d/useStudioTourWiring'

let compact = true
vi.mock('@/lib/compactStudio', async (orig) => ({
  ...(await orig<typeof import('@/lib/compactStudio')>()),
  useCompactStudio: () => compact,
}))
vi.mock('@/components/ui/ConfirmDialog', () => ({ useConfirm: () => vi.fn() }))
vi.mock('@/components/ui/Toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@/components/studio/RoomSettingsSheet', () => ({ default: () => null }))
vi.mock('@/components/studio/UnsavedChangesGuard', () => ({ UnsavedChangesGuard: () => null }))
vi.mock('@/hooks/useRestoreUserModels', () => ({ useRestoreUserModels: () => {} }))
vi.mock('@/lib/api', async (orig) => ({
  ...(await orig<typeof import('@/lib/api')>()),
  getRoom: vi.fn().mockResolvedValue({ id: 'r1', apartment_id: 'a1', name: 'Zal', length: 4, width: 3, ceiling_height: 2.7, area: 12 }),
}))

import StudioPage from '../StudioPage'

/** A stand-in for the 3D view: a scene target, and readiness as the test sets it. */
function SceneTab({ ready }: { ready: boolean }) {
  const { setStudioTourReady, studioTourActive } = useOutletContext<StudioContext>()
  useEffect(() => {
    setStudioTourReady?.(ready)
    return () => setStudioTourReady?.(false)
  }, [ready, setStudioTourReady])
  return (
    <div data-tour="scene">
      <p>scene</p>
      <p data-testid="active">{String(!!studioTourActive)}</p>
    </div>
  )
}

function ui(ready: boolean) {
  return (
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/studio/r1']}>
        <Routes>
          <Route path="/studio/:roomId" element={<StudioPage />}>
            <Route index element={<SceneTab ready={ready} />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

const sceneTitle = () => i18n.t('studio.tour.scene.title')
const tourCard = () => screen.queryByRole('dialog', { name: sceneTitle() })

beforeEach(() => {
  compact = true
  localStorage.clear()
  // jsdom lays nothing out: every tour target gets a box on screen.
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const on = this.hasAttribute('data-tour') || this.getAttribute('role') === 'dialog'
    const w = on ? 40 : 0
    return { left: 10, top: 10, width: w, height: w, x: 10, y: 10, right: 10 + w, bottom: 10 + w, toJSON: () => ({}) } as DOMRect
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
  sessionStorage.clear()
})

describe('the studio tour in StudioPage', () => {
  it('(a) starts on the first live 3D view on a phone', async () => {
    render(ui(true))
    await screen.findByText('scene')
    expect(await screen.findByRole('dialog', { name: sceneTitle() })).toBeInTheDocument()
  })

  it('(b) waits while the view is not ready (panorama, a camera), marking nothing, then starts', async () => {
    const { rerender } = render(ui(false))
    await screen.findByText('scene')
    expect(tourCard()).toBeNull()
    expect(localStorage.getItem(STUDIO_TOUR_KEY)).toBeNull()
    rerender(ui(true))
    expect(await screen.findByRole('dialog', { name: sceneTitle() })).toBeInTheDocument()
  })

  it('(c) does not start once done, but "?" replays it', async () => {
    localStorage.setItem(STUDIO_TOUR_KEY, '1')
    render(ui(true))
    await screen.findByText('scene')
    expect(tourCard()).toBeNull()
    const help = screen.getByRole('button', { name: i18n.t('studio.tour.help_btn') })
    expect(help).toHaveAttribute('data-tour', 'help')
    fireEvent.click(help)
    expect(tourCard()).toBeInTheDocument()
  })

  it('finishing marks the tour done and the tap hint seen', async () => {
    render(ui(true))
    await screen.findByRole('dialog', { name: sceneTitle() })
    fireEvent.click(screen.getByRole('button', { name: i18n.t('studio.tour.skip') }))
    expect(tourCard()).toBeNull()
    expect(localStorage.getItem(STUDIO_TOUR_KEY)).toBe('1')
    expect(localStorage.getItem('studio.tapHint.seen')).toBe('1')
  })

  it('does not open, nor mark done, when no target is on screen (W1)', async () => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(() =>
      ({ left: 0, top: 0, width: 0, height: 0, x: 0, y: 0, right: 0, bottom: 0, toJSON: () => ({}) }) as DOMRect)
    render(ui(true))
    await screen.findByText('scene')
    await act(async () => {})
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(localStorage.getItem(STUDIO_TOUR_KEY)).toBeNull()
  })

  it('(d) starts with the view locked too (readiness does not look at the lock)', async () => {
    // The lock lives in ThreeDPage and only hides TapHint; StudioPage is told ready either way.
    const { useViewLockStore } = await import('@/store/viewLockStore')
    useViewLockStore.setState({ locked: true })
    render(ui(true))
    expect(await screen.findByRole('dialog', { name: sceneTitle() })).toBeInTheDocument()
    useViewLockStore.setState({ locked: false })
  })

  it('(e) tells the page the tour is on', async () => {
    render(ui(true))
    await screen.findByRole('dialog', { name: sceneTitle() })
    expect(screen.getByTestId('active')).toHaveTextContent('true')
    fireEvent.click(screen.getByRole('button', { name: i18n.t('studio.tour.skip') }))
    expect(screen.getByTestId('active')).toHaveTextContent('false')
  })

  it('(f) has no tour and no "?" on a desktop', async () => {
    compact = false
    render(ui(true))
    await screen.findByText('scene')
    await act(async () => {})
    expect(tourCard()).toBeNull()
    expect(screen.queryByRole('button', { name: i18n.t('studio.tour.help_btn') })).toBeNull()
  })

  it('a storage that throws: skip still closes the tour, and it does not reopen', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
    render(ui(true))
    await screen.findByRole('dialog', { name: sceneTitle() })
    fireEvent.click(screen.getByRole('button', { name: i18n.t('studio.tour.skip') }))
    await act(async () => {})
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('shows "?" on every phone view, and a press while not ready opens the tour once ready', async () => {
    localStorage.setItem(STUDIO_TOUR_KEY, '1')
    const { rerender } = render(ui(false))
    await screen.findByText('scene')
    fireEvent.click(screen.getByRole('button', { name: i18n.t('studio.tour.help_btn') }))
    await act(async () => {})
    expect(tourCard()).toBeNull()
    rerender(ui(true))
    expect(await screen.findByRole('dialog', { name: sceneTitle() })).toBeInTheDocument()
  })

  it('puts the header targets in place', async () => {
    render(ui(false))
    await screen.findByText('scene')
    expect(document.querySelector('[data-tour="undo"]')).not.toBeNull()
    expect(document.querySelector('[data-tour="menu"]')).toHaveAttribute('aria-label', i18n.t('studio.menu.more'))
  })
})

describe('studioTourReady (ThreeDPage)', () => {
  const clear = { compact: true, panorama: false, cameraStation: null, planShown: false }
  it('is ready on a phone\'s live editing view, and not in panorama, a camera, a 2D plan or on a desktop', () => {
    expect(studioTourReady(clear)).toBe(true)
    expect(studioTourReady({ ...clear, panorama: true })).toBe(false)
    expect(studioTourReady({ ...clear, cameraStation: 2 })).toBe(false)
    expect(studioTourReady({ ...clear, planShown: true })).toBe(false)
    expect(studioTourReady({ ...clear, compact: false })).toBe(false)
  })
  it('ignores the view lock', () => {
    expect(studioTourReady({ ...clear, locked: true } as Parameters<typeof studioTourReady>[0])).toBe(true)
  })
})

describe('useStudioTourWiring (ThreeDPage)', () => {
  it('(e) reports readiness and clears the ring and selection as the tour starts', () => {
    const setReady = vi.fn()
    const onStart = vi.fn()
    const onEnd = vi.fn()
    const { rerender, unmount } = renderHook(
      ({ active, ready }) => useStudioTourWiring({ active, ready, setReady, onStart, onEnd }),
      { initialProps: { active: false, ready: true } },
    )
    expect(setReady).toHaveBeenLastCalledWith(true)
    expect(onStart).not.toHaveBeenCalled()
    rerender({ active: true, ready: true })
    expect(onStart).toHaveBeenCalledTimes(1)
    expect(onEnd).not.toHaveBeenCalled()
    rerender({ active: false, ready: true })
    expect(onEnd).toHaveBeenCalledTimes(1)
    rerender({ active: false, ready: false })
    expect(setReady).toHaveBeenLastCalledWith(false)
    unmount()
    expect(setReady).toHaveBeenLastCalledWith(false)
  })
})
