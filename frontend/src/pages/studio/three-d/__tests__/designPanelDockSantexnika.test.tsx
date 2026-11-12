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
  // Mobile QA (iPhone screenshot 2026-11-12): scrolled down, the list slid under the sheet's rounded
  // top and the close button scrolled away with it; the last line sat on the home indicator.
  it('Santexnika keeps its close button on top while the form scrolls', () => {
    render(<DesignPanelDock {...props('santexnika')} />)
    const bar = screen.getAllByRole('button')[0].parentElement!
    expect(bar.className).toContain('sticky')
    expect(bar.className).toContain('top-0')
    expect(bar.className).toContain('bg-card')
  })
  it('Santexnika leaves room for the home indicator at the bottom', () => {
    render(<DesignPanelDock {...props('santexnika')} />)
    expect(screen.getByTestId('design-panel-mobile').className).toContain('pb-[env(safe-area-inset-bottom)]')
  })
  it('other stages keep the right half, so the wall stays in view', () => {
    render(<DesignPanelDock {...props('boyoq')} />)
    expect(screen.getByTestId('design-panel-mobile').className).toContain('w-1/2')
  })
})
