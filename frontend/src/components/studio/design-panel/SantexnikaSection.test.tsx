import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { useRoomStore } from '@/store/roomStore'
import type { CatalogFurniture } from '@/lib/api'
import { roomModel } from '@/lib/aiDesignLayout'
import { SantexnikaSection } from './SantexnikaSection'
import { plumbingSummary, riserSpot } from '@/lib/plumbingRuns'

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
