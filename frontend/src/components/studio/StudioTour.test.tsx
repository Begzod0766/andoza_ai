import { StrictMode } from 'react'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import i18n from '@/i18n'
import { StudioTour } from './StudioTour'
import { STUDIO_TOUR_STEPS, TOUR_SKIP_EVENT, type StudioTourStep, type StudioTourStepId } from '@/lib/studioTour'
import { emitTourEvent, onTourEvent } from '@/lib/studioTourEvents'
import { loadPractice, savePractice } from '@/lib/tourPractice'
import { useRoomStore } from '@/store/roomStore'
import type { PlacedFurniture } from '@/store/types'
import uz from '@/i18n/locales/uz.json'
import ru from '@/i18n/locales/ru.json'
import en from '@/i18n/locales/en.json'

// Test steps by data-tour target; the step ids are stand-ins (scene -> surface, arc -> furniture).
const ID_OF: Record<string, StudioTourStepId> = { scene: 'surface', arc: 'furniture', menu: 'menu' }
const tour = (...targets: string[]): StudioTourStep[] =>
  targets.map((t) => ({ id: ID_OF[t], kind: 'show', targets: [t] }))

let rects: Record<string, { left: number; top: number; width: number; height: number }>

function rectOf(r: { left: number; top: number; width: number; height: number }): DOMRect {
  return { ...r, x: r.left, y: r.top, right: r.left + r.width, bottom: r.top + r.height, toJSON: () => ({}) } as DOMRect
}

function mount(ids: string[], onClicks: Record<string, () => void> = {}) {
  ids.forEach((id) => {
    const el = document.createElement('button')
    el.setAttribute('data-tour', id)
    el.addEventListener('click', onClicks[id] ?? (() => {}))
    document.body.appendChild(el)
  })
}

beforeEach(() => {
  rects = {
    scene: { left: 20, top: 100, width: 200, height: 100 },
    menu: { left: 300, top: 10, width: 40, height: 40 },
  }
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    // A ring's hand anchor (QuarterArcMenu) is measured as `@hand`.
    const id = this.getAttribute('data-tour') ?? (this.hasAttribute('data-tour-hand-at') ? '@hand' : null)
    if (this.getAttribute('role') === 'dialog') return rectOf({ left: 0, top: 0, width: 300, height: 200 })
    const r = id ? rects[id] : undefined
    return rectOf(r ?? { left: 0, top: 0, width: 0, height: 0 })
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

describe('StudioTour', () => {
  it('shows the first step, and the hole button advances without clicking the target', () => {
    const onTarget = vi.fn()
    mount(['scene', 'menu'], { scene: onTarget })
    const { container } = render(<StudioTour steps={tour('scene', 'menu')} roomId="r1" onFinish={() => {}} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('1/2')).toBeInTheDocument()
    expect(screen.getByText(i18n.t('studio.tour.surface.body'))).toBeInTheDocument()
    fireEvent.click(container.querySelector('[data-tour-hole]') as HTMLElement)
    expect(screen.getByText('2/2')).toBeInTheDocument()
    expect(onTarget).not.toHaveBeenCalled()
  })

  it('a click on the backdrop changes nothing', () => {
    mount(['scene', 'menu'])
    const { container } = render(<StudioTour steps={tour('scene', 'menu')} roomId="r1" onFinish={() => {}} />)
    const backdrops = container.querySelectorAll('[data-tour-backdrop]')
    expect(backdrops).toHaveLength(4)
    backdrops.forEach((b) => fireEvent.click(b))
    expect(screen.getByText('1/2')).toBeInTheDocument()
  })

  it('the last step finishes once with Done', () => {
    const onFinish = vi.fn()
    mount(['scene', 'menu'])
    render(<StudioTour steps={tour('scene', 'menu')} roomId="r1" onFinish={onFinish} />)
    fireEvent.click(screen.getAllByRole('button', { name: i18n.t('studio.tour.next') })[0])
    fireEvent.click(screen.getByRole('button', { name: i18n.t('studio.tour.done') }))
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish).toHaveBeenCalledWith('done')
  })

  it('skip finishes too', () => {
    const onFinish = vi.fn()
    mount(['scene', 'menu'])
    render(<StudioTour steps={tour('scene', 'menu')} roomId="r1" onFinish={onFinish} />)
    fireEvent.click(screen.getByRole('button', { name: i18n.t('studio.tour.skip') }))
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish).toHaveBeenCalledWith('skip')
  })

  it('re-measures the target on resize', () => {
    mount(['scene', 'menu'])
    const { container } = render(<StudioTour steps={tour('scene', 'menu')} roomId="r1" onFinish={() => {}} />)
    const hole = () => container.querySelector('[data-tour-hole]') as HTMLElement
    expect(hole().style.left).toBe('12px')
    rects.scene = { left: 50, top: 100, width: 200, height: 100 }
    act(() => { window.dispatchEvent(new Event('resize')) })
    expect(hole().style.left).toBe('42px')
  })

  it('finishes at once when no target is on screen', () => {
    const onFinish = vi.fn()
    const { container } = render(<StudioTour steps={tour('scene', 'menu')} roomId="r1" onFinish={onFinish} />)
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(container.firstChild).toBeNull()
    expect(onFinish).toHaveBeenCalledWith('unmount')
  })

  it('keeps the card inside the viewport for a target that fills the view', () => {
    rects.scene = { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight }
    mount(['scene', 'menu'])
    render(<StudioTour steps={tour('scene', 'menu')} roomId="r1" onFinish={() => {}} />)
    const top = parseFloat(screen.getByRole('dialog').style.top)
    expect(top).toBeGreaterThanOrEqual(0)
    expect(top + 200).toBeLessThanOrEqual(window.innerHeight)
  })

  it('advances past a target that vanishes, and finishes when the last one does', () => {
    const onFinish = vi.fn()
    mount(['scene', 'menu'])
    render(<StudioTour steps={tour('scene', 'menu')} roomId="r1" onFinish={onFinish} />)
    rects.scene = { left: 0, top: 0, width: 0, height: 0 }
    act(() => { window.dispatchEvent(new Event('resize')) })
    expect(screen.getByText(i18n.t('studio.tour.menu.body'))).toBeInTheDocument()
    expect(onFinish).not.toHaveBeenCalled()
    rects.menu = { left: 0, top: 0, width: 0, height: 0 }
    act(() => { window.dispatchEvent(new Event('resize')) })
    expect(onFinish).toHaveBeenCalledTimes(1)
  })

  it('a rotation (resize + orientationchange back to back) with a vanished target moves on once', () => {
    const onFinish = vi.fn()
    mount(['scene', 'menu', 'arc'])
    rects.arc = { left: 10, top: 300, width: 40, height: 40 }
    render(<StudioTour steps={tour('scene', 'menu', 'arc')} roomId="r1" onFinish={onFinish} />)
    rects.scene = { left: 0, top: 0, width: 0, height: 0 }
    act(() => {
      window.dispatchEvent(new Event('resize'))
      window.dispatchEvent(new Event('orientationchange'))
    })
    // menu is still there: it must not be skipped, and the counter does not jump
    expect(screen.getByText(i18n.t('studio.tour.menu.body'))).toBeInTheDocument()
    expect(screen.getByText('1/2')).toBeInTheDocument()
    expect(onFinish).not.toHaveBeenCalled()
  })

  it('a rotation that takes the remaining targets away finishes once instead of hanging', () => {
    const onFinish = vi.fn()
    mount(['scene', 'menu', 'arc'])
    rects.arc = { left: 10, top: 300, width: 40, height: 40 }
    const { container } = render(<StudioTour steps={tour('scene', 'menu', 'arc')} roomId="r1" onFinish={onFinish} />)
    fireEvent.click(container.querySelector('[data-tour-hole]') as HTMLElement)
    expect(screen.getByText(i18n.t('studio.tour.menu.body'))).toBeInTheDocument()
    rects.menu = { left: 0, top: 0, width: 0, height: 0 }
    rects.arc = { left: 0, top: 0, width: 0, height: 0 }
    act(() => {
      window.dispatchEvent(new Event('resize'))
      window.dispatchEvent(new Event('orientationchange'))
    })
    expect(onFinish).toHaveBeenCalledTimes(1)
  })

  it('the card is a modal dialog', () => {
    mount(['scene'])
    render(<StudioTour steps={tour('scene')} roomId="r1" onFinish={() => {}} />)
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
  })

  it('treats an off-screen target as absent', () => {
    rects.scene = { left: 5000, top: 5000, width: 50, height: 50 }
    mount(['scene', 'menu'])
    render(<StudioTour steps={tour('scene', 'menu')} roomId="r1" onFinish={() => {}} />)
    expect(screen.getByText('1/1')).toBeInTheDocument()
  })

  it('calls onFinish once under StrictMode with no targets', () => {
    const onFinish = vi.fn()
    render(<StrictMode><StudioTour steps={tour('scene')} roomId="r1" onFinish={onFinish} /></StrictMode>)
    expect(onFinish).toHaveBeenCalledTimes(1)
  })

  it('calls onFinish once on a double tap of Skip', () => {
    const onFinish = vi.fn()
    mount(['scene', 'menu'])
    render(<StudioTour steps={tour('scene', 'menu')} roomId="r1" onFinish={onFinish} />)
    const skip = screen.getByRole('button', { name: i18n.t('studio.tour.skip') })
    fireEvent.click(skip)
    fireEvent.click(skip)
    expect(onFinish).toHaveBeenCalledTimes(1)
  })
})

describe('StudioTour app bridge', () => {
  let posted: string[]
  beforeEach(() => {
    posted = []
    ;(window as unknown as { AndozaStudioTour?: { postMessage: (m: string) => void } }).AndozaStudioTour = {
      postMessage: (m: string) => posted.push(m),
    }
  })
  afterEach(() => {
    delete (window as unknown as { AndozaStudioTour?: unknown }).AndozaStudioTour
  })

  it('tells the app when the tour opens and when it closes', () => {
    mount(['scene', 'menu'])
    render(<StudioTour steps={tour('scene', 'menu')} roomId="r1" onFinish={() => {}} />)
    expect(posted).toEqual(['open'])
    fireEvent.click(screen.getByText(i18n.t('studio.tour.skip')))
    expect(posted).toEqual(['open', 'closed'])
  })

  it('tells the app the tour closed when it unmounts mid-way', () => {
    mount(['scene', 'menu'])
    const { unmount } = render(<StudioTour steps={tour('scene', 'menu')} roomId="r1" onFinish={() => {}} />)
    unmount()
    expect(posted.at(-1)).toBe('closed')
  })

  it('the app asking to skip ends the tour like Skip', () => {
    const onFinish = vi.fn()
    mount(['scene', 'menu'])
    render(<StudioTour steps={tour('scene', 'menu')} roomId="r1" onFinish={onFinish} />)
    act(() => { window.dispatchEvent(new Event('andoza:tour-skip')) })
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish).toHaveBeenCalledWith('app')
  })

  it('says nothing when no target is on screen', () => {
    render(<StudioTour steps={tour('scene')} roomId="r1" onFinish={() => {}} />)
    expect(posted).not.toContain('open')
  })

  it('works without the app (plain browser)', () => {
    delete (window as unknown as { AndozaStudioTour?: unknown }).AndozaStudioTour
    mount(['scene'])
    render(<StudioTour steps={tour('scene')} roomId="r1" onFinish={() => {}} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})

// --- do steps: the user acts on the target themselves ---

const a: PlacedFurniture = { id: 'a', furniture_id: 'sofa', x: 1, y: 1, rotation: 0 }
const b: PlacedFurniture = { id: 'b', furniture_id: 'chair', x: 2, y: 2, rotation: 0 }
const STEP = (id: StudioTourStepId) => STUDIO_TOUR_STEPS.find((s) => s.id === id)!
const frame = () => act(() => { vi.advanceTimersByTime(20) })

describe('StudioTour do steps', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'] })
    useRoomStore.getState().resetRoom()
    useRoomStore.setState({ furniture: [a], viewStage: 'full' })
    localStorage.clear()
    Object.assign(rects, {
      'arc-mebel': { left: 300, top: 600, width: 50, height: 50 },
      'arc-mebel-ring-0': { left: 150, top: 450, width: 200, height: 200 },
      stage: { left: 10, top: 600, width: 60, height: 40 },
    })
  })
  afterEach(() => {
    vi.useRealTimers()
    localStorage.clear()
  })

  it('do_surface_hole_passes_click: no hole button, four backdrops, body only, no Next', () => {
    mount(['scene', 'menu'])
    const { container } = render(<StudioTour steps={[STEP('surface'), STEP('menu')]} roomId="r1" onFinish={() => {}} />)
    expect(container.querySelector('[data-tour-hole]')).toBeNull()
    expect(container.querySelectorAll('[data-tour-backdrop]')).toHaveLength(4)
    expect(screen.getByText(i18n.t('studio.tour.surface.body'))).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: i18n.t('studio.tour.next') })).toBeNull()
    expect(screen.getByRole('button', { name: i18n.t('studio.tour.skip') })).toBeInTheDocument()
    expect(screen.getByText('1/2')).toBeInTheDocument()
  })

  it('surface_completes_on_event', () => {
    const onStepChange = vi.fn()
    mount(['scene', 'arc-mebel'])
    const { container } = render(
      <StudioTour steps={[STEP('surface'), STEP('furniture')]} roomId="r1" onStepChange={onStepChange} onFinish={() => {}} />,
    )
    expect(onStepChange).toHaveBeenLastCalledWith('surface')
    act(() => emitTourEvent('surface-picked'))
    expect(container.querySelector('[data-tour-check]')).not.toBeNull()
    expect(onStepChange).not.toHaveBeenCalledWith('furniture')
    act(() => { vi.advanceTimersByTime(600) })
    expect(onStepChange).toHaveBeenLastCalledWith('furniture')
    expect(container.querySelector('[data-tour-check]')).toBeNull()
  })

  it('furniture_deepest_target: the spotlight follows the deepest target on screen, frame by frame', () => {
    mount(['arc-mebel'])
    const { container } = render(<StudioTour steps={[STEP('furniture')]} roomId="r1" onFinish={() => {}} />)
    const ring = () => container.querySelector('[data-tour-ring]') as HTMLElement
    expect(ring().style.left).toBe('292px')
    mount(['arc-mebel-ring-0'])
    frame()
    expect(ring().style.left).toBe('142px')
    expect(ring().style.width).toBe('216px')
    document.querySelector('[data-tour="arc-mebel-ring-0"]')!.remove()
    frame()
    expect(ring().style.left).toBe('292px')
  })

  it('hand_at_ring_anchor: on a ring the hand points at its anchor (the outer ring), else at the target centre', () => {
    mount(['arc-mebel'])
    const { container } = render(<StudioTour steps={[STEP('furniture')]} roomId="r1" onFinish={() => {}} />)
    const hand = () => container.querySelector('[data-tour-hand] > div') as HTMLElement
    // the category button: its centre
    expect(hand().style.left).toBe('325px')
    expect(hand().style.top).toBe('625px')
    mount(['arc-mebel-ring-0'])
    const at = document.createElement('span')
    at.setAttribute('data-tour-hand-at', '')
    document.querySelector('[data-tour="arc-mebel-ring-0"]')!.appendChild(at)
    rects['@hand'] = { left: 199, top: 499, width: 2, height: 2 }
    frame()
    expect(hand().style.left).toBe('200px')
    expect(hand().style.top).toBe('500px')
    // an anchor with no box (not laid out) falls back to the centre
    rects['@hand'] = { left: 0, top: 0, width: 0, height: 0 }
    frame()
    expect(hand().style.left).toBe('250px')
    expect(hand().style.top).toBe('550px')
  })

  it('do_step_survives_a_brief_vanish: under 500 ms without any target is not a vanish; 500 ms or more is', () => {
    const onStepChange = vi.fn()
    mount(['arc-mebel', 'stage'])
    render(<StudioTour steps={[STEP('furniture'), STEP('stage')]} roomId="r1" onStepChange={onStepChange} onFinish={() => {}} />)
    const saved = rects['arc-mebel']
    rects['arc-mebel'] = { left: 0, top: 0, width: 0, height: 0 }
    act(() => { vi.advanceTimersByTime(300) })
    expect(onStepChange).toHaveBeenLastCalledWith('furniture')
    rects['arc-mebel'] = saved
    frame()
    act(() => { vi.advanceTimersByTime(400) })
    // the earlier gap does not add up with a later one
    rects['arc-mebel'] = { left: 0, top: 0, width: 0, height: 0 }
    act(() => { vi.advanceTimersByTime(300) })
    expect(onStepChange).toHaveBeenLastCalledWith('furniture')
    expect(screen.getByText('1/2')).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(300) })
    expect(onStepChange).toHaveBeenLastCalledWith('stage')
    expect(screen.getByText('1/1')).toBeInTheDocument()
  })

  it('step_change_grace: a new step whose target shows a moment later is kept, everything covered meanwhile', () => {
    const onStepChange = vi.fn()
    mount(['scene', 'arc-mebel', 'stage'])
    const { container } = render(
      <StudioTour steps={[STEP('surface'), STEP('furniture'), STEP('stage')]} roomId="r1" onStepChange={onStepChange} onFinish={() => {}} />,
    )
    // the furniture step's arc is on screen as the tour opens, then hidden by the page on step 1
    expect(screen.getByText('1/3')).toBeInTheDocument()
    document.querySelector('[data-tour="arc-mebel"]')!.remove()
    act(() => emitTourEvent('surface-picked'))
    act(() => { vi.advanceTimersByTime(600) })
    expect(onStepChange).toHaveBeenLastCalledWith('furniture')
    // not on screen yet: all covered, no hole, no hand
    expect(container.querySelectorAll('[data-tour-backdrop]')).toHaveLength(1)
    expect(container.querySelector('[data-tour-ring]')).toBeNull()
    expect(container.querySelector('[data-tour-hand]')).toBeNull()
    act(() => { vi.advanceTimersByTime(200) })
    mount(['arc-mebel'])
    frame()
    expect(onStepChange).toHaveBeenLastCalledWith('furniture')
    expect(screen.getByText('2/3')).toBeInTheDocument()
    expect(container.querySelector('[data-tour-ring]')).not.toBeNull()
  })

  it('step_change_grace: a new step whose target never shows is dropped after 500 ms', () => {
    const onStepChange = vi.fn()
    mount(['scene', 'arc-mebel', 'stage'])
    render(<StudioTour steps={[STEP('surface'), STEP('furniture'), STEP('stage')]} roomId="r1" onStepChange={onStepChange} onFinish={() => {}} />)
    document.querySelector('[data-tour="arc-mebel"]')!.remove()
    act(() => emitTourEvent('surface-picked'))
    act(() => { vi.advanceTimersByTime(600) })
    act(() => { vi.advanceTimersByTime(300) })
    expect(onStepChange).toHaveBeenLastCalledWith('furniture')
    act(() => { vi.advanceTimersByTime(300) })
    expect(onStepChange).toHaveBeenLastCalledWith('stage')
  })

  it('a do step whose targets are gone at a resize moves on at once', () => {
    const onStepChange = vi.fn()
    mount(['arc-mebel', 'stage'])
    render(<StudioTour steps={[STEP('furniture'), STEP('stage')]} roomId="r1" onStepChange={onStepChange} onFinish={() => {}} />)
    rects['arc-mebel'] = { left: 0, top: 0, width: 0, height: 0 }
    act(() => { window.dispatchEvent(new Event('resize')) })
    expect(onStepChange).toHaveBeenLastCalledWith('stage')
  })

  it('furniture_completes_on_new_id, not on moving an old one', () => {
    mount(['arc-mebel'])
    const { container } = render(<StudioTour steps={[STEP('furniture'), STEP('stage')]} roomId="r1" onFinish={() => {}} />)
    act(() => { useRoomStore.setState({ furniture: [{ ...a, x: 9 }] }) })
    expect(container.querySelector('[data-tour-check]')).toBeNull()
    act(() => { useRoomStore.setState({ furniture: [{ ...a, x: 9 }, b] }) })
    expect(container.querySelector('[data-tour-check]')).not.toBeNull()
  })

  it('practice_saved: the furniture added during the tour is written down', () => {
    mount(['arc-mebel'])
    render(<StudioTour steps={[STEP('furniture'), STEP('stage')]} roomId="r1" onFinish={() => {}} />)
    act(() => { useRoomStore.setState({ furniture: [a, b] }) })
    expect(loadPractice('r1')).toEqual({ roomId: 'r1', ids: ['b'] })
  })

  it('stage_completes_on_change', () => {
    const onFinish = vi.fn()
    mount(['stage'])
    const { container } = render(<StudioTour steps={[STEP('stage')]} roomId="r1" onFinish={onFinish} />)
    act(() => { useRoomStore.setState({ viewStage: 'suvoq' }) })
    expect(container.querySelector('[data-tour-check]')).not.toBeNull()
    act(() => { vi.advanceTimersByTime(600) })
    // the last step done by the user ends the tour as Done
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish).toHaveBeenCalledWith('done')
  })

  it('hand_replays_after_idle: the hand is remounted after 10 s without a tap', () => {
    mount(['scene'])
    const { container } = render(<StudioTour steps={[STEP('surface')]} roomId="r1" onFinish={() => {}} />)
    const hand = () => container.querySelector('[data-tour-hand] > div')
    const first = hand()
    expect(first).not.toBeNull()
    // the fingertip sits on the target's centre
    expect((first as HTMLElement).style.left).toBe('120px')
    expect((first as HTMLElement).style.top).toBe('150px')
    act(() => { vi.advanceTimersByTime(9000) })
    expect(hand()).toBe(first)
    act(() => { vi.advanceTimersByTime(1100) })
    expect(hand()).not.toBeNull()
    expect(hand()).not.toBe(first)
  })

  it('show_step_keeps_next: the hole of a show step is a Next button', () => {
    mount(['menu', 'undo'])
    rects.undo = { left: 250, top: 10, width: 40, height: 40 }
    const onStepChange = vi.fn()
    const { container } = render(
      <StudioTour steps={[STEP('menu'), STEP('undo')]} roomId="r1" onStepChange={onStepChange} onFinish={() => {}} />,
    )
    expect(screen.getAllByRole('button', { name: i18n.t('studio.tour.next') })).toHaveLength(2)
    expect(container.querySelector('[data-tour-hand]')).toBeNull()
    fireEvent.click(container.querySelector('[data-tour-hole]') as HTMLElement)
    expect(onStepChange).toHaveBeenLastCalledWith('undo')
  })

  it('tells onStepChange null when the tour ends', () => {
    const onStepChange = vi.fn()
    mount(['scene'])
    render(<StudioTour steps={[STEP('surface')]} roomId="r1" onStepChange={onStepChange} onFinish={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: i18n.t('studio.tour.skip') }))
    expect(onStepChange).toHaveBeenLastCalledWith(null)
  })
})

describe('StudioTour texts', () => {
  it('every step has a body in all three languages', () => {
    const tours = { uz, ru, en } as unknown as Record<string, { studio: { tour: Record<string, { body?: string }> } }>
    for (const [lang, file] of Object.entries(tours)) {
      for (const s of STUDIO_TOUR_STEPS) {
        expect(file.studio.tour[s.id]?.body, `${lang}: studio.tour.${s.id}.body`).toEqual(expect.any(String))
      }
    }
  })
})

// --- the end: restore the view, ask about the practice furniture, clean up when interrupted ---

describe('StudioTour ending', () => {
  const removeSpy = () => vi.spyOn(useRoomStore.getState(), 'removeFurnitureMany')
  const ids = () => useRoomStore.getState().furniture.map((f) => f.id)
  const question = () => screen.queryByRole('alertdialog')
  const flush = () => act(async () => { await Promise.resolve() })

  beforeEach(() => {
    useRoomStore.getState().resetRoom()
    useRoomStore.setState({ furniture: [a], viewStage: 'full' })
    localStorage.clear()
    mount(['scene'])
  })
  afterEach(() => localStorage.clear())

  const open = (onFinish = vi.fn(), roomId = 'r1') => {
    const r = render(<StudioTour steps={tour('scene')} roomId={roomId} onFinish={onFinish} />)
    return { ...r, onFinish }
  }
  const practise = () => act(() => { useRoomStore.setState({ furniture: [a, b] }) })
  const done = () => fireEvent.click(screen.getByRole('button', { name: i18n.t('studio.tour.done') }))

  it('done_without_practice_no_question', () => {
    const { onFinish } = open()
    done()
    expect(question()).toBeNull()
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish).toHaveBeenCalledWith('done')
  })

  it('restore_before_question', () => {
    const seen: (HTMLElement | null)[] = []
    const off = onTourEvent('restore-view', () => seen.push(question()))
    const { onFinish, container } = open()
    practise()
    done()
    off()
    expect(seen).toEqual([null])
    expect(question()).toHaveTextContent(i18n.t('studio.tour.practice_question'))
    // while asking: no spotlight, no backdrop, and the tour has not ended yet
    expect(container.querySelector('[data-tour-backdrop]')).toBeNull()
    expect(container.querySelector('[data-tour-hole]')).toBeNull()
    expect(onFinish).not.toHaveBeenCalled()
  })

  it('skip asks too', () => {
    const { onFinish } = open()
    practise()
    fireEvent.click(screen.getByRole('button', { name: i18n.t('studio.tour.skip') }))
    expect(question()).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: i18n.t('studio.tour.practice_keep') }))
    expect(onFinish).toHaveBeenCalledWith('skip')
  })

  it('remove_answer', () => {
    const { onFinish } = open()
    practise()
    done()
    fireEvent.click(screen.getByRole('button', { name: i18n.t('studio.tour.practice_remove') }))
    expect(ids()).toEqual(['a'])
    expect(loadPractice('r1')).toBeNull()
    expect(question()).toBeNull()
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish).toHaveBeenCalledWith('done')
  })

  it('keep_answer', () => {
    const { onFinish } = open()
    practise()
    done()
    fireEvent.click(screen.getByRole('button', { name: i18n.t('studio.tour.practice_keep') }))
    expect(ids()).toEqual(['a', 'b'])
    expect(loadPractice('r1')).toBeNull()
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish).toHaveBeenCalledWith('done')
  })

  it('question_takes_focus: a keyboard or screen-reader user lands in the question', () => {
    open()
    practise()
    done()
    const dialog = question()!
    expect(dialog.contains(document.activeElement)).toBe(true)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: i18n.t('studio.tour.practice_remove') }))
    expect(dialog).not.toHaveAttribute('aria-modal')
    // named by the question once: no aria-describedby repeating the same text
    expect(dialog).toHaveAccessibleName(i18n.t('studio.tour.practice_question'))
    expect(dialog).not.toHaveAttribute('aria-describedby')
  })

  it('practice_frozen_at_question: furniture added while asking is neither removed nor recorded', () => {
    const c: PlacedFurniture = { id: 'c', furniture_id: 'lamp', x: 3, y: 3, rotation: 0 }
    open()
    practise()
    done()
    act(() => { useRoomStore.setState({ furniture: [a, b, c] }) })
    expect(loadPractice('r1')).toEqual({ roomId: 'r1', ids: ['b'] })
    fireEvent.click(screen.getByRole('button', { name: i18n.t('studio.tour.practice_remove') }))
    expect(ids()).toEqual(['a', 'c'])
    expect(loadPractice('r1')).toBeNull()
  })

  it('user_deleted_practice_itself', () => {
    const { onFinish } = open()
    practise()
    act(() => { useRoomStore.setState({ furniture: [a] }) })
    done()
    expect(question()).toBeNull()
    expect(onFinish).toHaveBeenCalledWith('done')
  })

  it('app_back_removes_silently', () => {
    const restore = vi.fn()
    const off = onTourEvent('restore-view', restore)
    const { onFinish } = open()
    practise()
    act(() => { window.dispatchEvent(new Event(TOUR_SKIP_EVENT)) })
    off()
    expect(restore).toHaveBeenCalledTimes(1)
    expect(question()).toBeNull()
    expect(ids()).toEqual(['a'])
    expect(loadPractice('r1')).toBeNull()
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish).toHaveBeenCalledWith('app')
  })

  it('app_back_during_question_once', () => {
    const { onFinish } = open()
    practise()
    done()
    expect(question()).not.toBeNull()
    const spy = removeSpy()
    act(() => {
      window.dispatchEvent(new Event(TOUR_SKIP_EVENT))
      window.dispatchEvent(new Event(TOUR_SKIP_EVENT))
    })
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish).toHaveBeenCalledWith('app')
    expect(spy).toHaveBeenCalledTimes(1)
    expect(ids()).toEqual(['a'])
    expect(question()).toBeNull()
  })

  it('unmount_removes_silently, and keeps the record for the next open (the page autosave is gone)', async () => {
    const onStepChange = vi.fn()
    const onFinish = vi.fn()
    const restore = vi.fn()
    const off = onTourEvent('restore-view', restore)
    const { unmount } = render(<StudioTour steps={tour('scene')} roomId="r1" onStepChange={onStepChange} onFinish={onFinish} />)
    practise()
    unmount()
    await flush()
    off()
    expect(restore).toHaveBeenCalledTimes(1)
    expect(ids()).toEqual(['a'])
    expect(loadPractice('r1')).toEqual({ roomId: 'r1', ids: ['b'] })
    expect(onStepChange).toHaveBeenLastCalledWith(null)
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish).toHaveBeenCalledWith('unmount')
  })

  it('unmount during the question removes silently', async () => {
    const { onFinish, unmount } = open()
    practise()
    done()
    unmount()
    await flush()
    expect(ids()).toEqual(['a'])
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish).toHaveBeenCalledWith('unmount')
  })

  it('unmount_strict_mode: the simulated remount neither removes furniture nor finishes', async () => {
    const onFinish = vi.fn()
    const { unmount } = render(<StrictMode><StudioTour steps={tour('scene')} roomId="r1" onFinish={onFinish} /></StrictMode>)
    practise()
    await flush()
    expect(ids()).toEqual(['a', 'b'])
    expect(onFinish).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    unmount()
    await flush()
    expect(ids()).toEqual(['a'])
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish).toHaveBeenCalledWith('unmount')
  })

  it('targets_vanish_removes_silently', () => {
    const { onFinish } = open()
    practise()
    expect(loadPractice('r1')).toEqual({ roomId: 'r1', ids: ['b'] })
    rects.scene = { left: 0, top: 0, width: 0, height: 0 }
    act(() => { window.dispatchEvent(new Event('resize')) })
    expect(question()).toBeNull()
    expect(ids()).toEqual(['a'])
    expect(loadPractice('r1')).toBeNull()
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish).toHaveBeenCalledWith('unmount')
  })

  it('room_change_keeps_record', async () => {
    const spy = removeSpy()
    const onFinish = vi.fn()
    const { rerender, unmount } = render(<StudioTour steps={tour('scene')} roomId="r1" onFinish={onFinish} />)
    practise()
    rerender(<StudioTour steps={tour('scene')} roomId="r2" onFinish={onFinish} />)
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish).toHaveBeenCalledWith('unmount')
    unmount()
    await flush()
    expect(spy).not.toHaveBeenCalled()
    expect(loadPractice('r1')).toEqual({ roomId: 'r1', ids: ['b'] })
  })

  // A tour cut off in room A (app killed) leaves A's record; a later tour in room B must not
  // clear or overwrite it, so A's next open still takes A's practice furniture out.
  it('cross_room: a tour in another room ending with no practice leaves the first room\'s record', () => {
    savePractice({ roomId: 'A', ids: ['x'] })
    const { onFinish } = open(vi.fn(), 'B')
    done()
    expect(onFinish).toHaveBeenCalledWith('done')
    expect(loadPractice('A')).toEqual({ roomId: 'A', ids: ['x'] })
  })

  it('cross_room: a tour in another room with practice (kept, removed, skipped, interrupted) leaves the first room\'s record', () => {
    savePractice({ roomId: 'A', ids: ['x'] })
    const first = open(vi.fn(), 'B')
    practise()
    expect(loadPractice('B')).toEqual({ roomId: 'B', ids: ['b'] })
    expect(loadPractice('A')).toEqual({ roomId: 'A', ids: ['x'] })
    done()
    fireEvent.click(screen.getByRole('button', { name: i18n.t('studio.tour.practice_remove') }))
    expect(loadPractice('B')).toBeNull()
    expect(loadPractice('A')).toEqual({ roomId: 'A', ids: ['x'] })
    first.unmount()

    useRoomStore.setState({ furniture: [a] })
    open(vi.fn(), 'B')
    practise()
    act(() => { window.dispatchEvent(new Event(TOUR_SKIP_EVENT)) })
    expect(loadPractice('B')).toBeNull()
    expect(loadPractice('A')).toEqual({ roomId: 'A', ids: ['x'] })
  })
})

describe('StudioTour practice texts', () => {
  it('the practice question is in all three languages', () => {
    const files = { uz, ru, en } as unknown as Record<string, { studio: { tour: Record<string, unknown> } }>
    for (const [lang, file] of Object.entries(files)) {
      for (const k of ['practice_question', 'practice_remove', 'practice_keep']) {
        expect(file.studio.tour[k], `${lang}: studio.tour.${k}`).toEqual(expect.any(String))
      }
    }
    expect(uz.studio.tour.practice_question).toBe("Mashqda qo'shilgan mebel qoldirilsinmi?")
    expect(uz.studio.tour.practice_remove).toBe('Olib tashlash')
    expect(uz.studio.tour.practice_keep).toBe('Qoldirish')
  })
})
