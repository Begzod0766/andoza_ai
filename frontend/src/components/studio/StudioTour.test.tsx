import { StrictMode } from 'react'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import i18n from '@/i18n'
import { StudioTour } from './StudioTour'

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
    const { container } = render(<StudioTour steps={['scene', 'menu']} onFinish={() => {}} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('1/2')).toBeInTheDocument()
    expect(screen.getByText(i18n.t('studio.tour.scene.title'))).toBeInTheDocument()
    fireEvent.click(container.querySelector('[data-tour-hole]') as HTMLElement)
    expect(screen.getByText('2/2')).toBeInTheDocument()
    expect(onTarget).not.toHaveBeenCalled()
  })

  it('a click on the backdrop changes nothing', () => {
    mount(['scene', 'menu'])
    const { container } = render(<StudioTour steps={['scene', 'menu']} onFinish={() => {}} />)
    const backdrops = container.querySelectorAll('[data-tour-backdrop]')
    expect(backdrops).toHaveLength(4)
    backdrops.forEach((b) => fireEvent.click(b))
    expect(screen.getByText('1/2')).toBeInTheDocument()
  })

  it('the last step finishes once with Done', () => {
    const onFinish = vi.fn()
    mount(['scene', 'menu'])
    render(<StudioTour steps={['scene', 'menu']} onFinish={onFinish} />)
    fireEvent.click(screen.getAllByRole('button', { name: i18n.t('studio.tour.next') })[0])
    fireEvent.click(screen.getByRole('button', { name: i18n.t('studio.tour.done') }))
    expect(onFinish).toHaveBeenCalledTimes(1)
  })

  it('skip finishes too', () => {
    const onFinish = vi.fn()
    mount(['scene', 'menu'])
    render(<StudioTour steps={['scene', 'menu']} onFinish={onFinish} />)
    fireEvent.click(screen.getByRole('button', { name: i18n.t('studio.tour.skip') }))
    expect(onFinish).toHaveBeenCalledTimes(1)
  })

  it('re-measures the target on resize', () => {
    mount(['scene', 'menu'])
    const { container } = render(<StudioTour steps={['scene', 'menu']} onFinish={() => {}} />)
    const hole = () => container.querySelector('[data-tour-hole]') as HTMLElement
    expect(hole().style.left).toBe('12px')
    rects.scene = { left: 50, top: 100, width: 200, height: 100 }
    act(() => { window.dispatchEvent(new Event('resize')) })
    expect(hole().style.left).toBe('42px')
  })

  it('finishes at once when no target is on screen', () => {
    const onFinish = vi.fn()
    const { container } = render(<StudioTour steps={['scene', 'menu']} onFinish={onFinish} />)
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(container.firstChild).toBeNull()
  })

  it('keeps the card inside the viewport for a target that fills the view', () => {
    rects.scene = { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight }
    mount(['scene', 'menu'])
    render(<StudioTour steps={['scene', 'menu']} onFinish={() => {}} />)
    const top = parseFloat(screen.getByRole('dialog').style.top)
    expect(top).toBeGreaterThanOrEqual(0)
    expect(top + 200).toBeLessThanOrEqual(window.innerHeight)
  })

  it('advances past a target that vanishes, and finishes when the last one does', () => {
    const onFinish = vi.fn()
    mount(['scene', 'menu'])
    render(<StudioTour steps={['scene', 'menu']} onFinish={onFinish} />)
    rects.scene = { left: 0, top: 0, width: 0, height: 0 }
    act(() => { window.dispatchEvent(new Event('resize')) })
    expect(screen.getByText(i18n.t('studio.tour.menu.title'))).toBeInTheDocument()
    expect(onFinish).not.toHaveBeenCalled()
    rects.menu = { left: 0, top: 0, width: 0, height: 0 }
    act(() => { window.dispatchEvent(new Event('resize')) })
    expect(onFinish).toHaveBeenCalledTimes(1)
  })

  it('treats an off-screen target as absent', () => {
    rects.scene = { left: 5000, top: 5000, width: 50, height: 50 }
    mount(['scene', 'menu'])
    render(<StudioTour steps={['scene', 'menu']} onFinish={() => {}} />)
    expect(screen.getByText('1/1')).toBeInTheDocument()
  })

  it('calls onFinish once under StrictMode with no targets', () => {
    const onFinish = vi.fn()
    render(<StrictMode><StudioTour steps={['scene']} onFinish={onFinish} /></StrictMode>)
    expect(onFinish).toHaveBeenCalledTimes(1)
  })

  it('calls onFinish once on a double tap of Skip', () => {
    const onFinish = vi.fn()
    mount(['scene', 'menu'])
    render(<StudioTour steps={['scene', 'menu']} onFinish={onFinish} />)
    const skip = screen.getByRole('button', { name: i18n.t('studio.tour.skip') })
    fireEvent.click(skip)
    fireEvent.click(skip)
    expect(onFinish).toHaveBeenCalledTimes(1)
  })
})
