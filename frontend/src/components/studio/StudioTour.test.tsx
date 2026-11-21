import { StrictMode } from 'react'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import i18n from '@/i18n'
import { StudioTour } from './StudioTour'
import { STUDIO_TOUR_STEPS, type StudioTourStep, type StudioTourStepId } from '@/lib/studioTour'
import { emitTourEvent } from '@/lib/studioTourEvents'
import { loadPractice, clearPractice } from '@/lib/tourPractice'
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
    const id = this.getAttribute('data-tour')
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
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame'] })
    useRoomStore.getState().resetRoom()
    useRoomStore.setState({ furniture: [a], viewStage: 'full' })
    clearPractice()
    Object.assign(rects, {
      'arc-mebel': { left: 300, top: 600, width: 50, height: 50 },
      'arc-mebel-ring-0': { left: 150, top: 450, width: 200, height: 200 },
      stage: { left: 10, top: 600, width: 60, height: 40 },
    })
  })
  afterEach(() => {
    vi.useRealTimers()
    clearPractice()
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
    expect(loadPractice()).toEqual({ roomId: 'r1', ids: ['b'] })
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
