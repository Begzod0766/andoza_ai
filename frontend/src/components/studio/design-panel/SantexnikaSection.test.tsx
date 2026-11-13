import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { useRoomStore } from '@/store/roomStore'
import type { CatalogFurniture } from '@/lib/api'
import { roomModel } from '@/lib/aiDesignLayout'
import { SantexnikaSection } from './SantexnikaSection'
import { plumbingSummary, riserSpot, roomRiser } from '@/lib/plumbingRuns'
import { pipeScheme } from '@/lib/pipeScheme'
import { formatDecimal } from '@/lib/utils'

const row = (id: string, name: string, w: number, d: number) =>
  ({ id, name_uz: name, category: 'boshqa', room_type: 'hammom', store_id: 's', store_name: 'H', placement: 'pol', price_uzs: 1, glb_url: 'x', thumbnail_url: null, footprint_w: w, footprint_d: d }) as CatalogFurniture

const geometry = { walls: [
  { id: 'A', length: 2500, elements: [] }, { id: 'B', length: 2000, elements: [] },
  { id: 'C', length: 2500, elements: [] }, { id: 'D', length: 2000, elements: [] },
] }

function placeOn(id: string, furnitureId: string, wallId: string, d: number) {
  const w = roomModel(useRoomStore.getState().geometry).walls.find((x) => x.id === wallId)!
  const out = d / 2 + 0.04
  useRoomStore.getState().placeFurniture({ id, furniture_id: furnitureId, x: (w.midX + w.nx * out) * 1000, y: (w.midZ + w.nz * out) * 1000, rotation: Math.atan2(w.nx, w.nz) })
}

beforeEach(() => {
  useRoomStore.getState().resetRoom()
  useRoomStore.setState({ geometry: geometry as never, roomType: 'hammom', catalogFurniture: [row('vanna', 'Vanna 1', 170, 70), row('rak', 'Rakovina 3', 41, 62)] })
})

describe('SantexnikaSection', () => {
  it("lists the room's fixtures and their points", () => {
    placeOn('tub', 'vanna', 'A', 0.7)
    render(<SantexnikaSection />)
    expect(screen.getByText('Vanna 1')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem', { name: /kanalizatsiya|sovuq suv|issiq suv/i })).toHaveLength(3)
  })

  it('adds a point by hand, with no fixture of its own', () => {
    render(<SantexnikaSection />)
    fireEvent.change(screen.getByLabelText('Turi'), { target: { value: 'cold' } })
    fireEvent.change(screen.getByLabelText('Devor'), { target: { value: 'B' } })
    fireEvent.change(screen.getByLabelText('Balandligi, sm'), { target: { value: '90' } })
    fireEvent.click(screen.getByRole('button', { name: /nuqta qo'shish/i }))
    const pts = useRoomStore.getState().plumbing
    expect(pts).toHaveLength(1)
    expect(pts[0]).toMatchObject({ kind: 'cold', wallId: 'B', heightMm: 900 })
    expect(pts[0].fixtureId).toBeUndefined()
  })

  it('a hand point can be removed from its row', () => {
    useRoomStore.getState().addPlumbing({ id: 'wm', kind: 'drain', diameterMm: 50, wallId: 'C', positionMm: 500, heightMm: 500 })
    render(<SantexnikaSection />)
    const item = screen.getByRole('listitem', { name: /kanalizatsiya/i })
    fireEvent.click(within(item).getByRole('button', { name: /olib tashlash/i }))
    expect(useRoomStore.getState().plumbing).toEqual([])
  })

  it('sums the points up: drains and water, with pipe metres', () => {
    placeOn('tub', 'vanna', 'A', 0.7)
    render(<SantexnikaSection />)
    const s = useRoomStore.getState()
    const sum = plumbingSummary(s.geometry, s.plumbing, riserSpot(s.geometry))
    expect(screen.getByText(new RegExp(`Kanalizatsiya: ${sum.drain.points} nuqta`))).toBeInTheDocument()
    expect(screen.getByText(new RegExp(`Suv: ${sum.water.points} nuqta`))).toBeInTheDocument()
  })

  it('its pipe metres are the pipe scheme\'s, the same the estimate prices (spec 2026-11-11)', () => {
    placeOn('tub', 'vanna', 'A', 0.7)
    placeOn('sink', 'rak', 'C', 0.62)
    render(<SantexnikaSection />)
    const s = useRoomStore.getState()
    const p = pipeScheme(s.geometry, riserSpot(s.geometry), s.plumbing).pipes
    const m = (mm: number) => formatDecimal(Math.round(mm / 1000 * 1.15 * 100) / 100, 1)
    const dm = m(p.drain_50.trunkMm + p.drain_50.branchMm + p.drain_110.trunkMm + p.drain_110.branchMm)
    const wm = m(p.water_20.trunkMm + p.water_20.branchMm)
    expect(screen.getByText(`Kanalizatsiya: 2 nuqta, ~${dm} m · Suv: 4 nuqta, ~${wm} m`)).toBeInTheDocument()
  })

  // The riser the user moves (2026-11-13).
  describe('the riser', () => {
    it('shows where it is: the door corner until one is set', () => {
      render(<SantexnikaSection />)
      const auto = riserSpot(useRoomStore.getState().geometry)
      expect((screen.getByLabelText('Stoyak devori') as HTMLSelectElement).value).toBe(auto.wallId)
      expect((screen.getByLabelText('Devor boshidan, sm') as HTMLInputElement).value).toBe(String(Math.round(auto.positionMm / 10)))
      expect(screen.getByRole('button', { name: /Avtomatik/ })).toBeDisabled()
    })
    it('a wall and a distance set it by hand; "Avtomatik" puts it back at the door corner', () => {
      render(<SantexnikaSection />)
      fireEvent.change(screen.getByLabelText('Stoyak devori'), { target: { value: 'C' } })
      expect(useRoomStore.getState().plumbingRiser?.wallId).toBe('C')
      fireEvent.change(screen.getByLabelText('Devor boshidan, sm'), { target: { value: '120' } })
      fireEvent.blur(screen.getByLabelText('Devor boshidan, sm'))
      expect(useRoomStore.getState().plumbingRiser).toEqual({ wallId: 'C', positionMm: 1200 })
      fireEvent.click(screen.getByRole('button', { name: /Avtomatik/ }))
      expect(useRoomStore.getState().plumbingRiser).toBeNull()
    })
    it('a distance past the wall\'s end stops at its end', () => {
      render(<SantexnikaSection />)
      fireEvent.change(screen.getByLabelText('Stoyak devori'), { target: { value: 'B' } })
      fireEvent.change(screen.getByLabelText('Devor boshidan, sm'), { target: { value: '999' } })
      fireEvent.blur(screen.getByLabelText('Devor boshidan, sm'))
      expect(useRoomStore.getState().plumbingRiser).toEqual({ wallId: 'B', positionMm: 2000 })
    })
    it('the summary measures from the riser the user set', () => {
      placeOn('tub', 'vanna', 'A', 0.7)
      useRoomStore.getState().setPlumbingRiser({ wallId: 'C', positionMm: 1250 })
      render(<SantexnikaSection />)
      const s = useRoomStore.getState()
      const sum = plumbingSummary(s.geometry, s.plumbing, roomRiser(s.geometry, s.plumbingRiser))
      const auto = plumbingSummary(s.geometry, s.plumbing, riserSpot(s.geometry))
      expect(sum.water.m).not.toBe(auto.water.m)
      expect(screen.getByText(new RegExp(`Suv: 2 nuqta, ~${formatDecimal(sum.water.m, 1)} m`))).toBeInTheDocument()
    })
  })

  // Old plumbing out and pipes in the wall (2026-11-13): two switches, for the estimate.
  it('"remove the old plumbing" is off until ticked; "pipes in the wall" is on until unticked', () => {
    render(<SantexnikaSection />)
    const demolish = screen.getByLabelText('Eski santexnikani olib tashlash') as HTMLInputElement
    const inWall = screen.getByLabelText('Quvurlar devor ichida (shtroba)') as HTMLInputElement
    expect(demolish.checked).toBe(false)
    expect(inWall.checked).toBe(true)
    fireEvent.click(demolish)
    fireEvent.click(inWall)
    expect(useRoomStore.getState().designState.plumbingDemolition).toBe(true)
    expect(useRoomStore.getState().designState.pipesInWall).toBe(false)
    expect(useRoomStore.getState().isDirty).toBe(true)
  })
  it('"water heater" is off until ticked, in a bathroom and a kitchen (2026-11-13)', () => {
    render(<SantexnikaSection />)
    const heater = screen.getByLabelText('Suv isitgich (boyler)') as HTMLInputElement
    expect(heater.checked).toBe(false)
    fireEvent.click(heater)
    expect(useRoomStore.getState().designState.waterHeater).toBe(true)
  })
  it('both switches are in a kitchen too', () => {
    useRoomStore.setState({ roomType: 'oshxona' })
    render(<SantexnikaSection />)
    expect(screen.getByLabelText('Eski santexnikani olib tashlash')).toBeInTheDocument()
    expect(screen.getByLabelText('Quvurlar devor ichida (shtroba)')).toBeInTheDocument()
  })

  // A washing machine (spec 2026-11-13).
  describe('the washing machine', () => {
    it('is added from the panel, listed, its two points with it, and removed with them', () => {
      render(<SantexnikaSection bathroom />)
      fireEvent.click(screen.getByRole('button', { name: "Kir yuvish mashinasi qo'shish" }))
      const s = useRoomStore.getState()
      expect(s.washers).toHaveLength(1)
      expect(screen.getAllByText('(mashinaniki)')).toHaveLength(2)
      const row = screen.getByRole('listitem', { name: /^Kir yuvish mashinasi/ })
      fireEvent.click(within(row).getByRole('button', { name: 'Olib tashlash' }))
      expect(useRoomStore.getState().washers).toEqual([])
      expect(screen.queryAllByText('(mashinaniki)')).toHaveLength(0)
    })
    it('its points raise the summary by one water and one drain point', () => {
      render(<SantexnikaSection bathroom />)
      const before = screen.getByText(/Kanalizatsiya: \d+ nuqta/).textContent!
      fireEvent.click(screen.getByRole('button', { name: "Kir yuvish mashinasi qo'shish" }))
      const after = screen.getByText(/Kanalizatsiya: \d+ nuqta/).textContent!
      const n = (t: string, re: RegExp) => Number(re.exec(t)![1])
      expect(n(after, /Kanalizatsiya: (\d+)/)).toBe(n(before, /Kanalizatsiya: (\d+)/) + 1)
      expect(n(after, /Suv: (\d+)/)).toBe(n(before, /Suv: (\d+)/) + 1)
    })
    it('is offered in a kitchen too', () => {
      useRoomStore.setState({ roomType: 'oshxona' })
      render(<SantexnikaSection />)
      expect(screen.getByRole('button', { name: "Kir yuvish mashinasi qo'shish" })).toBeInTheDocument()
    })
    it('no room left: the panel says so', () => {
      useRoomStore.setState({ geometry: { walls: [] } as never })
      render(<SantexnikaSection bathroom />)
      fireEvent.click(screen.getByRole('button', { name: "Kir yuvish mashinasi qo'shish" }))
      expect(screen.getByRole('alert')).toHaveTextContent("Devorlarda kir yuvish mashinasi uchun joy yo'q.")
    })
  })

  it('in a kitchen, a sink brings its three points', () => {
    useRoomStore.setState({ roomType: 'oshxona' })
    placeOn('sink', 'rak', 'B', 0.62)
    render(<SantexnikaSection />)
    expect(screen.getAllByRole('listitem', { name: /kanalizatsiya|sovuq suv|issiq suv/i })).toHaveLength(3)
  })
})

describe('SantexnikaSection pipe runs toggle', () => {
  // Mobile QA 2026-11-09 #3 (user's call): on a phone the open panel hides half the 3D, so the runs
  // stay drawn after the panel closes, until the box is unticked.
  it('switches the pipe runs on, and they stay on after the panel closes until unticked', () => {
    const { unmount } = render(<SantexnikaSection />)
    fireEvent.click(screen.getByRole('checkbox', { name: /quvur yo'llarini ko'rsatish/i }))
    expect(useRoomStore.getState().showPipeRuns).toBe(true)
    unmount()
    expect(useRoomStore.getState().showPipeRuns).toBe(true)
  })
})

describe('SantexnikaSection on a phone (mobile QA 2026-11-09)', () => {
  it('#4: the height field scrolls into view when focused, above the keyboard', () => {
    const spy = vi.fn()
    Element.prototype.scrollIntoView = spy
    render(<SantexnikaSection />)
    fireEvent.focus(screen.getByLabelText('Balandligi, sm'))
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ block: 'center' }))
  })

  it('#5: in English the fixtures read by what they are, the model number kept', async () => {
    const i18n = (await import('@/i18n')).default
    await i18n.changeLanguage('en')
    try {
      placeOn('tub', 'vanna', 'A', 0.7)
      render(<SantexnikaSection />)
      expect(screen.getByText('Bathtub 1')).toBeInTheDocument()
      expect(screen.queryByText('Vanna 1')).toBeNull()
    } finally { await i18n.changeLanguage('uz') }
  })

  it('#6: the add button says "Add a point" once, with no "+" in the words', async () => {
    const i18n = (await import('@/i18n')).default
    for (const lng of ['uz', 'ru', 'en']) expect(i18n.t('studio.santexnika.add', { lng })).not.toMatch(/^\+/)
  })
})

describe('the wall picker follows the room (review minor 2026-11-09)', () => {
  it('when the room\'s walls change under an open panel, a new point goes on a wall the room has', () => {
    render(<SantexnikaSection />)
    useRoomStore.setState({ geometry: { walls: [{ id: 'W1', length: 3000, elements: [] }, { id: 'W2', length: 2000, elements: [] }, { id: 'W3', length: 3000, elements: [] }] } as never })
    fireEvent.click(screen.getByRole('button', { name: /nuqta qo'shish/i }))
    expect(useRoomStore.getState().plumbing.at(-1)!.wallId).toBe('W1')
  })
})
