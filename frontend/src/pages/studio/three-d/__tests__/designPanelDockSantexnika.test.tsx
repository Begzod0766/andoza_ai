/**
 * Mobile QA 2026-11-09 #1: on a phone the Santexnika panel took the right half, so each point broke
 * over three lines and the "Kind" picker showed "Dr". This stage is a form: it comes up from the
 * bottom at full width, the 3D (and its pipe runs) stays visible above it.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
vi.mock('@/components/studio/DesignPanel', () => ({ DesignPanel: () => <div>panel</div> }))
import { DesignPanelDock } from '../DesignPanelDock'

const props = (activePhase: string) => ({
  showPanel: true, setShowPanel: () => {}, rightOpen: true, setRightOpen: () => {}, room: {} as never,
  activePhase: activePhase as never, selectedWall: null, setSelectedWall: () => {}, selectedLightId: null,
  selectLight: () => {}, armedLightType: null, setArmedLightType: () => {}, planMode: false,
})

describe('the design panel on a phone', () => {
  it.each(['quvurlar', 'jihozlar'])('%s comes up from the bottom at full width', (phase) => {
    render(<DesignPanelDock {...props(phase)} />)
    const panel = screen.getByTestId('design-panel-mobile')
    expect(panel.className).toContain('w-full')
    expect(panel.className).toContain('bottom-0')
    expect(panel.className).not.toContain('w-1/2')
    // On a desktop it is the docked sidebar like every other stage.
    expect(panel.className).toContain('lg:translate-y-0')
    expect(panel.className).toContain('lg:static')
  })
  // Mobile QA 2026-11-12: scrolled down, the list slid under the sheet's rounded top and the close
  // button scrolled away; the last line sat on the home indicator. A sticky bar did not do: on iOS a
  // row still showed a few pixels above the rounded top (re-check 2026-11-12, #244). Now only the
  // body below the close bar scrolls, inside a sheet that clips.
  it.each(['quvurlar', 'jihozlar'])('%s scrolls its body only, below a close bar that stays put', (phase) => {
    render(<DesignPanelDock {...props(phase)} />)
    const sheet = screen.getByTestId('design-panel-mobile')
    expect(sheet.className).toContain('overflow-hidden')
    expect(sheet.className).not.toMatch(/(^| )overflow-y-auto/)
    const body = screen.getByTestId('design-panel-scroll')
    expect(body.className).toContain('overflow-y-auto')
    expect(body.className).toContain('min-h-0')
    expect(body.className).toContain('pb-[env(safe-area-inset-bottom)]')
    const bar = screen.getAllByRole('button')[0].parentElement!
    expect(body.contains(bar)).toBe(false)
    expect(bar.className).toContain('shrink-0')
  })
  // Re-check 2026-11-12, #244: a 1 pt light line down the sheet's left edge — the sidebar's border.
  it('the left border is a desktop sidebar\'s only', () => {
    render(<DesignPanelDock {...props('jihozlar')} />)
    const panel = screen.getByTestId('design-panel-mobile')
    expect(panel.className).toContain('lg:border-l')
    expect(panel.className).not.toMatch(/(^| )border-l( |$)/)
  })
  it('other stages keep the right half, so the wall stays in view', () => {
    render(<DesignPanelDock {...props('boyoq')} />)
    expect(screen.getByTestId('design-panel-mobile').className).toContain('w-1/2')
  })
  // Mobile QA 2026-11-18 (#299): the riser, the towel rail and the machines are dragged in the 3D only while
  // the plumbing sheet is open, but a full-screen catch layer over the 3D took every touch and closed
  // the sheet. Above a plumbing sheet the 3D stays live; the sheet closes with its own button.
  it.each(['quvurlar', 'jihozlar'])('%s leaves the 3D above the sheet touchable', (phase) => {
    const { container } = render(<DesignPanelDock {...props(phase)} />)
    expect(container.querySelector('.fixed.inset-0')).toBeNull()
    expect(screen.getAllByRole('button')[0].getAttribute('aria-label')).toBeTruthy()
  })
  it('the half-width panel of the other stages still closes on a tap beside it', () => {
    const setShowPanel = vi.fn()
    const { container } = render(<DesignPanelDock {...props('boyoq')} setShowPanel={setShowPanel} />)
    const backdrop = container.querySelector('.fixed.inset-0') as HTMLElement
    expect(backdrop).not.toBeNull()
    backdrop.click()
    expect(setShowPanel).toHaveBeenCalledWith(false)
  })
})

// QA #380 3: a tap within the 300 ms the closed sheet takes to slide away landed on the sheet, not the 3D.
describe('the closed design panel on a phone lets taps through as it slides away', () => {
  it.each(['quvurlar', 'jihozlar', 'devor'])('%s: closed, it catches no taps (on a desktop, docked, it does)', (phase) => {
    render(<DesignPanelDock {...props(phase)} showPanel={false} />)
    const panel = screen.getByTestId('design-panel-mobile')
    expect(panel.className).toMatch(/(^| )pointer-events-none( |$)/)
    expect(panel.className).toContain('lg:pointer-events-auto')
  })
  it('open, it does', () => {
    render(<DesignPanelDock {...props('jihozlar')} />)
    expect(screen.getByTestId('design-panel-mobile').className).not.toMatch(/(^| )pointer-events-none( |$)/)
  })
})
