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
  it('Santexnika comes up from the bottom at full width', () => {
    render(<DesignPanelDock {...props('santexnika')} />)
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
  it('Santexnika scrolls its body only, below a close bar that stays put', () => {
    render(<DesignPanelDock {...props('santexnika')} />)
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
    render(<DesignPanelDock {...props('santexnika')} />)
    const panel = screen.getByTestId('design-panel-mobile')
    expect(panel.className).toContain('lg:border-l')
    expect(panel.className).not.toMatch(/(^| )border-l( |$)/)
  })
  it('other stages keep the right half, so the wall stays in view', () => {
    render(<DesignPanelDock {...props('boyoq')} />)
    expect(screen.getByTestId('design-panel-mobile').className).toContain('w-1/2')
  })
})
