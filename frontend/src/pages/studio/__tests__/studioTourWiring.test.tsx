import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, act, renderHook, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { MemoryRouter, Outlet, Route, Routes, useOutletContext } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import i18n from '@/i18n'
import type { StudioContext } from '../ThreeDPage'
import { STUDIO_TOUR_KEY } from '@/lib/studioTour'
import { studioTourReady, useStudioTourWiring, usePendingPracticeCleanup } from '../three-d/useStudioTourWiring'
import { emitTourEvent, onTourEvent } from '@/lib/studioTourEvents'
import { loadPractice, savePractice } from '@/lib/tourPractice'
import { useRoomStore } from '@/store/roomStore'
import { getRoom, listCatalogFurniture } from '@/lib/api'
import type { StudioTourStepId } from '@/lib/studioTour'

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
  listCatalogFurniture: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, per_page: 100 }),
}))

// ThreeDPage with its R3F scene swapped for a wall button. A tap on a wall reaches the wall
// mesh first (focusSurface) and then its group (the radial menu's onClick), as r3f bubbles it.
vi.mock('../three-d/ThreeDCanvasScene', () => ({
  ThreeDCanvasScene: (p: { selectedWall: string | null; focusSurface: (id: string) => void; holdBind: (s: string, w?: string) => { onClick: (e: unknown) => void } }) => (
    <>
      <button onClick={() => { p.focusSurface('w1'); p.holdBind('wall', 'w1').onClick({ clientX: 5, clientY: 5 }) }}>wall</button>
      <p data-testid="selected-wall">{String(p.selectedWall)}</p>
    </>
  ),
}))
vi.mock('@/components/studio/SurfaceRadialMenu', async (orig) => ({
  ...(await orig<typeof import('@/components/studio/SurfaceRadialMenu')>()),
  default: () => <div data-testid="radial" />,
}))
vi.mock('@/components/studio/QuarterArcMenu', () => ({
  QuarterArcMenu: ({ tourId, closed }: { tourId?: string; closed?: boolean }) => <div data-tour={tourId} data-closed={String(!!closed)} />,
}))
vi.mock('../three-d/DesignPanelDock', () => ({
  DesignPanelDock: ({ activePhase }: { activePhase: string }) => <div data-testid="dock" data-phase={activePhase} />,
}))

import StudioPage from '../StudioPage'
import ThreeDPage from '../ThreeDPage'

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

const sceneTitle = () => i18n.t('studio.tour.surface.body')
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

describe('the studio tour, StudioPage side (task 7)', () => {
  function StepTab() {
    const { setStudioTourReady, studioTourStep } = useOutletContext<StudioContext>()
    useEffect(() => {
      setStudioTourReady?.(true)
      return () => setStudioTourReady?.(false)
    }, [setStudioTourReady])
    return <div data-tour="scene"><p>scene</p><p data-testid="step">{String(studioTourStep ?? null)}</p></div>
  }
  const stepUi = () => (
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/studio/r1']}>
        <Routes>
          <Route path="/studio/:roomId" element={<StudioPage />}>
            <Route index element={<StepTab />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )

  it('passes the current step to the page, and null once it ends', async () => {
    render(stepUi())
    await screen.findByRole('dialog', { name: sceneTitle() })
    expect(screen.getByTestId('step')).toHaveTextContent('surface')
    fireEvent.click(screen.getByRole('button', { name: i18n.t('studio.tour.skip') }))
    expect(screen.getByTestId('step')).toHaveTextContent('null')
  })

  it('waits for the room to load before opening (its furniture is the baseline)', async () => {
    let resolve: (v: unknown) => void = () => {}
    vi.mocked(getRoom).mockImplementationOnce(() => new Promise((r) => { resolve = r }) as ReturnType<typeof getRoom>)
    render(stepUi())
    await screen.findByText('scene')
    await act(async () => {})
    expect(tourCard()).toBeNull()
    await act(async () => { resolve({ id: 'r1', apartment_id: 'a1', name: 'Zal', length: 4, width: 3, ceiling_height: 2.7, area: 12 }) })
    expect(await screen.findByRole('dialog', { name: sceneTitle() })).toBeInTheDocument()
  })
})

describe('the studio tour, ThreeDPage side (task 7)', () => {
  const room = { id: 'r1', apartment_id: 'a1', name: 'Zal', length: 4, width: 3, ceiling_height: 2.7, area: 12 }
  type Ctx = { active?: boolean; step?: StudioTourStepId | null; roomReady?: boolean; at?: string; setReady?: (r: boolean) => void; client?: QueryClient }
  const page = ({ active = false, step = null, roomReady = true, at = '/studio/r1', setReady, client = new QueryClient({ defaultOptions: { queries: { retry: false } } }) }: Ctx = {}) => (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[at]}>
        <Routes>
          <Route path="/studio/:roomId" element={<Outlet context={{ room, onSave: async () => {}, roomReady, studioTourActive: active, studioTourStep: step, setStudioTourReady: setReady } as unknown as StudioContext} />}>
            <Route index element={<ThreeDPage />} />
            <Route path="mebel" element={<ThreeDPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
  const q = (id: string) => document.querySelector(`[data-tour="${id}"]`)
  const place = (id: string) => useRoomStore.getState().placeFurniture({ id, furniture_id: 'f', x: 0, y: 0, rotation: 0 })
  const ids = () => useRoomStore.getState().furniture.map((f) => f.id)

  beforeEach(() => {
    useRoomStore.getState().resetRoom()
  })

  it('surface_step_hides_floating_buttons', async () => {
    const { rerender } = render(page())
    await screen.findByText('wall')
    expect(q('lock')).not.toBeNull()
    expect(q('camera')).not.toBeNull()
    expect(q('arc')).not.toBeNull()
    expect(q('stage')).not.toBeNull()
    rerender(page({ active: true, step: 'surface' }))
    expect(q('lock')).toBeNull()
    expect(q('camera')).toBeNull()
    expect(q('arc')).toBeNull()
    expect(q('stage')).toBeNull()
    expect(q('scene')).not.toBeNull()
    rerender(page({ active: true, step: 'menu' }))
    expect(q('lock')).not.toBeNull()
    expect(q('arc')).not.toBeNull()
  })

  it('furniture_step_hides_floating_buttons but keeps the arc (its spotlight would leave them tappable)', async () => {
    const { rerender } = render(page())
    await screen.findByText('wall')
    rerender(page({ active: true, step: 'furniture' }))
    expect(q('lock')).toBeNull()
    expect(q('camera')).toBeNull()
    expect(q('stage')).toBeNull()
    expect(q('arc')).not.toBeNull()
    expect(q('scene')).not.toBeNull()
  })

  it('surface_and_furniture_steps_hide_the_mebel_pills and the 2D/3D toggle', async () => {
    const toggle = () => screen.queryByRole('switch', { name: i18n.t('studio.plan_toggle.aria') })
    const doors = () => screen.queryByTitle(i18n.t('studio.eshik_deraza_tahrirlash'))
    const { rerender } = render(page({ at: '/studio/r1/mebel' }))
    await screen.findByText('wall')
    expect(toggle()).not.toBeNull()
    expect(doors()).not.toBeNull()
    for (const step of ['surface', 'furniture'] as const) {
      rerender(page({ at: '/studio/r1/mebel', active: true, step }))
      expect(toggle()).toBeNull()
      expect(doors()).toBeNull()
    }
    rerender(page({ at: '/studio/r1/mebel', active: true, step: 'menu' }))
    expect(toggle()).not.toBeNull()
    expect(doors()).not.toBeNull()
  })

  it('catalog_settled: the tour is not ready until the furniture catalog has loaded (its arc key decides the furniture step)', async () => {
    let resolve: (v: unknown) => void = () => {}
    vi.mocked(listCatalogFurniture).mockImplementationOnce(() => new Promise((r) => { resolve = r }) as ReturnType<typeof listCatalogFurniture>)
    const setReady = vi.fn()
    render(page({ setReady }))
    await screen.findByText('wall')
    await act(async () => {})
    expect(setReady).not.toHaveBeenCalledWith(true)
    await act(async () => { resolve({ items: [], total: 0, page: 1, per_page: 100 }) })
    await waitFor(() => expect(setReady).toHaveBeenLastCalledWith(true))
  })

  it('catalog_settled: a catalog that fails to load lets the tour open too', async () => {
    let reject: (e: unknown) => void = () => {}
    vi.mocked(listCatalogFurniture).mockImplementationOnce(() => new Promise((_, r) => { reject = r }) as ReturnType<typeof listCatalogFurniture>)
    const setReady = vi.fn()
    render(page({ setReady }))
    await screen.findByText('wall')
    await act(async () => {})
    expect(setReady).not.toHaveBeenCalledWith(true)
    await act(async () => { reject(new Error('offline')) })
    await waitFor(() => expect(setReady).toHaveBeenLastCalledWith(true))
  })

  it('surface_pick_emits_and_closes_radial', async () => {
    const picked = vi.fn()
    const off = onTourEvent('surface-picked', picked)
    const { rerender } = render(page())
    fireEvent.click(await screen.findByText('wall'))
    expect(screen.getByTestId('radial')).toBeInTheDocument()
    expect(picked).not.toHaveBeenCalled()
    rerender(page({ active: true, step: 'surface' }))
    expect(screen.queryByTestId('radial')).toBeNull()
    fireEvent.click(screen.getByText('wall'))
    expect(picked).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('radial')).toBeNull()
    off()
  })

  it('wall_unselected_after_surface_step: the wall picked on step 1 is let go once the step is done, and at the end', async () => {
    const wall = () => screen.getByTestId('selected-wall')
    const { rerender } = render(page({ active: true, step: 'surface' }))
    fireEvent.click(await screen.findByText('wall'))
    // still selected while the step shows its check
    expect(wall()).toHaveTextContent('w1')
    rerender(page({ active: true, step: 'furniture' }))
    expect(wall()).toHaveTextContent('null')

    // the tour ending on the surface step lets it go too
    rerender(page({ active: true, step: 'surface' }))
    fireEvent.click(screen.getByText('wall'))
    expect(wall()).toHaveTextContent('w1')
    rerender(page({ active: false, step: null }))
    expect(wall()).toHaveTextContent('null')
  })

  it('wall_selection_untouched_without_a_tour', async () => {
    render(page())
    fireEvent.click(await screen.findByText('wall'))
    expect(screen.getByTestId('selected-wall')).toHaveTextContent('w1')
  })

  it('arc_open_only_on_furniture_step', async () => {
    const { rerender } = render(page({ active: true, step: 'furniture' }))
    await screen.findByText('wall')
    expect(q('arc')).toHaveAttribute('data-closed', 'false')
    rerender(page({ active: true, step: 'menu' }))
    expect(q('arc')).toHaveAttribute('data-closed', 'true')
    rerender(page({ active: false, step: null }))
    expect(q('arc')).toHaveAttribute('data-closed', 'false')
  })

  it('restore_view: the stage picked during the tour goes back to the one it opened on', async () => {
    const { rerender } = render(page())
    await screen.findByText('wall')
    expect(useRoomStore.getState().viewStage).toBe('full')
    rerender(page({ active: true, step: 'stage' }))
    const openedOn = screen.getByTestId('dock').getAttribute('data-phase')
    fireEvent.click(q('stage') as HTMLElement)
    const buttons = (q('stage-list') as HTMLElement).querySelectorAll('button')
    fireEvent.click(buttons[0])
    expect(useRoomStore.getState().viewStage).not.toBe('full')
    expect(screen.getByTestId('dock')).not.toHaveAttribute('data-phase', openedOn)
    act(() => emitTourEvent('restore-view'))
    expect(useRoomStore.getState().viewStage).toBe('full')
    expect(screen.getByTestId('dock')).toHaveAttribute('data-phase', openedOn)
  })

  it('pending_practice_same_room: the furniture an interrupted tour left is taken out once the room is ready', async () => {
    place('a'); place('b')
    savePractice({ roomId: room.id, ids: ['b'] })
    const { rerender } = render(page({ roomReady: false }))
    await screen.findByText('wall')
    expect(ids()).toEqual(['a', 'b'])
    rerender(page({ roomReady: true }))
    expect(ids()).toEqual(['a'])
    expect(loadPractice(room.id)).toBeNull()
  })

  it('pending_practice_other_room: another room\'s record is left alone', async () => {
    place('a'); place('b')
    savePractice({ roomId: 'other', ids: ['b'] })
    render(page({ roomReady: true }))
    await screen.findByText('wall')
    expect(ids()).toEqual(['a', 'b'])
    expect(loadPractice('other')).toEqual({ roomId: 'other', ids: ['b'] })
  })

  it('pending_practice_per_room: a record of another room written later does not hide this room\'s', async () => {
    place('a'); place('b')
    savePractice({ roomId: room.id, ids: ['b'] })
    savePractice({ roomId: 'other', ids: ['z'] })
    render(page({ roomReady: true }))
    await screen.findByText('wall')
    expect(ids()).toEqual(['a'])
    expect(loadPractice(room.id)).toBeNull()
    expect(loadPractice('other')).toEqual({ roomId: 'other', ids: ['z'] })
  })

  it('pending practice is not cleaned up while a tour is open', async () => {
    place('a'); place('b')
    savePractice({ roomId: room.id, ids: ['b'] })
    const { rerender } = render(page({ roomReady: true, active: true, step: 'surface' }))
    await screen.findByText('wall')
    expect(ids()).toEqual(['a', 'b'])
    expect(loadPractice(room.id)).not.toBeNull()
    rerender(page({ roomReady: true, active: false }))
    expect(ids()).toEqual(['a'])
  })
})

describe('useStudioTourWiring: the view the tour opened on (task 7)', () => {
  type V = { viewStage: string; activePhase: string }
  function setup() {
    const restoreView = vi.fn()
    const hook = renderHook(
      ({ active, view }: { active: boolean; view: V }) =>
        useStudioTourWiring({ active, ready: true, onStart: () => {}, onEnd: () => {}, view, restoreView }),
      { initialProps: { active: false, view: { viewStage: 'full', activePhase: 'boyoq' } } },
    )
    return { restoreView, ...hook }
  }

  it('restore_view: restores the snapshot from the start, once', () => {
    const { restoreView, rerender } = setup()
    rerender({ active: true, view: { viewStage: 'full', activePhase: 'boyoq' } })
    rerender({ active: true, view: { viewStage: 'suvoq', activePhase: 'suvoq' } })
    act(() => emitTourEvent('restore-view'))
    expect(restoreView).toHaveBeenCalledTimes(1)
    expect(restoreView).toHaveBeenLastCalledWith({ viewStage: 'full', activePhase: 'boyoq' })
    act(() => emitTourEvent('restore-view'))
    rerender({ active: false, view: { viewStage: 'full', activePhase: 'boyoq' } })
    expect(restoreView).toHaveBeenCalledTimes(1)
  })

  it('restores on end when no restore-view came, and does not listen once ended', () => {
    const { restoreView, rerender } = setup()
    rerender({ active: true, view: { viewStage: 'full', activePhase: 'boyoq' } })
    rerender({ active: true, view: { viewStage: 'suvoq', activePhase: 'suvoq' } })
    rerender({ active: false, view: { viewStage: 'suvoq', activePhase: 'suvoq' } })
    expect(restoreView).toHaveBeenCalledTimes(1)
    act(() => emitTourEvent('restore-view'))
    expect(restoreView).toHaveBeenCalledTimes(1)
  })
})

describe('usePendingPracticeCleanup (task 7)', () => {
  const place = (id: string) => useRoomStore.getState().placeFurniture({ id, furniture_id: 'f', x: 0, y: 0, rotation: 0 })
  const ids = () => useRoomStore.getState().furniture.map((f) => f.id)
  beforeEach(() => { useRoomStore.getState().resetRoom() })

  it('runs once per room open', () => {
    place('a'); place('b'); place('c')
    savePractice({ roomId: 'r1', ids: ['b'] })
    const { rerender } = renderHook(
      ({ roomReady }) => usePendingPracticeCleanup({ roomId: 'r1', roomReady, tourActive: false }),
      { initialProps: { roomReady: true } },
    )
    expect(ids()).toEqual(['a', 'c'])
    savePractice({ roomId: 'r1', ids: ['c'] })
    rerender({ roomReady: false })
    rerender({ roomReady: true })
    expect(ids()).toEqual(['a', 'c'])
  })
})
