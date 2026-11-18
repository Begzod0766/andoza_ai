import { describe, it, expect } from 'vitest'
import { visibleStages } from '../phases'
import { drawnAt, furnitureStage, coveringStage, stagedDesignState, hiddenAt, BARE_WALL } from '../stageView'
import type { DesignState } from '@/store/types'

const bath = visibleStages('hammom').map((s) => s.key)
const living = visibleStages('mehmonxona').map((s) => s.key)

describe('drawnAt (spec 2026-11-18): the room as it is at the picked stage', () => {
  it("'full' draws everything", () => {
    expect(drawnAt('mebel', 'full', bath)).toBe(true)
    expect(drawnAt('jihozlar', 'full', living)).toBe(true)
  })
  it('a thing of this stage or an earlier one is drawn, a later one is not', () => {
    expect(drawnAt('montaj', 'montaj', bath)).toBe(true)
    expect(drawnAt('pol', 'jihozlar', bath)).toBe(true)
    expect(drawnAt('jihozlar', 'montaj', bath)).toBe(false)
    expect(drawnAt('mebel', 'chiroq', bath)).toBe(false)
  })
  it("'always' is drawn at every stage, Quvurlar included", () => {
    expect(drawnAt('always', 'quvurlar', bath)).toBe(true)
  })
  it('a room with no Jihozlar stage shows plumbing things with the furniture', () => {
    expect(drawnAt('jihozlar', 'chiroq', living)).toBe(false)
    expect(drawnAt('jihozlar', 'mebel', living)).toBe(true)
  })
})

describe('furnitureStage', () => {
  it('a bathroom fixture comes with Jihozlar; a kitchen sink with its cabinets in Mebel', () => {
    expect(furnitureStage('Vanna 1', 'boshqa', 'hammom')).toBe('jihozlar')
    expect(furnitureStage('Rakovina 3', 'boshqa', 'oshxona')).toBe('mebel')
    expect(furnitureStage('Divan', 'divan', 'hammom')).toBe('mebel')
  })
})

describe('coveringStage', () => {
  it('the stage it was applied in when known; plaster is Suvoq, anything else Bo\'yoq', () => {
    expect(coveringStage({ kind: 'plaster' })).toBe('suvoq')
    expect(coveringStage({ kind: 'paint', color: '#fff' })).toBe('boyoq')
    expect(coveringStage({ kind: 'paint', color: '#fff', stage: 'shpaklovka' })).toBe('shpaklovka')
    expect(coveringStage({ kind: 'texture', url: 'u', color: '#fff', repeatX: 1, repeatY: 1, offsetX: 0, offsetY: 0, rotation: 0, stage: 'suvoq' })).toBe('suvoq')
  })
})

const ds = {
  wallCoverings: { ALL: { kind: 'paint', color: '#6D6A41' }, B: { kind: 'plaster' } },
  floorType: 'tile', floorConfigured: true, floorTexture: 'f.jpg', floorPattern: { id: 'herringbone' } as never,
  skirting: undefined, cornice: { profile: 'p' } as never, ceiling: { design: 'tray' } as never,
  backsplashes: [{ wallId: 'A' }] as never, wallPanels: { A: { enabled: true } as never },
} as unknown as DesignState

describe('stagedDesignState: the surfaces as they are at the stage', () => {
  it("'full' is the design itself, the same object", () => {
    expect(stagedDesignState(ds, 'full', bath)).toBe(ds)
  })
  it('Quvurlar: bare walls, a bare floor, no trims, no tile, the plain ceiling', () => {
    const s = stagedDesignState(ds, 'quvurlar', bath)
    expect(s.wallCoverings.ALL).toEqual(BARE_WALL.quvurlar)
    expect(s.wallCoverings.B).toEqual(BARE_WALL.quvurlar)
    expect(s.floorConfigured).toBe(false)
    expect(s.floorTexture).toBeNull()
    expect(s.floorPattern).toBeNull()
    expect(s.skirting).toBeNull()
    expect(s.cornice).toBeNull()
    expect(s.ceiling).toBeUndefined()
    expect(s.backsplashes).toBeUndefined()
    expect(s.wallPanels).toBeUndefined()
  })
  it('Suvoq: a plaster wall is itself, a painted one plaster', () => {
    const s = stagedDesignState(ds, 'suvoq', bath)
    expect(s.wallCoverings.B).toEqual({ kind: 'plaster' })
    expect(s.wallCoverings.ALL).toEqual(BARE_WALL.suvoq)
  })
  it('Shpaklovka: smooth and pale, unless the wall was finished in Shpaklovka itself', () => {
    expect(stagedDesignState(ds, 'shpaklovka', bath).wallCoverings.ALL).toEqual(BARE_WALL.shpaklovka)
    // A raw plaster wall, never finished (a new room's default), is puttied over too.
    expect(stagedDesignState(ds, 'shpaklovka', bath).wallCoverings.B).toEqual(BARE_WALL.shpaklovka)
    const own = { ...ds, wallCoverings: { ALL: { kind: 'paint', color: '#abc', stage: 'shpaklovka' } } } as unknown as DesignState
    expect(stagedDesignState(own, 'shpaklovka', bath).wallCoverings.ALL).toEqual({ kind: 'paint', color: '#abc', stage: 'shpaklovka' })
  })
  it("Bo'yoq: the walls, ceiling, cornice and backsplash are the user's; the floor is still bare", () => {
    const s = stagedDesignState(ds, 'boyoq', bath)
    expect(s.wallCoverings).toBe(ds.wallCoverings)
    expect(s.ceiling).toBe(ds.ceiling)
    expect(s.cornice).toBe(ds.cornice)
    expect(s.backsplashes).toBe(ds.backsplashes)
    expect(s.floorConfigured).toBe(false)
    expect(s.skirting).toBeNull()
  })
  it('Pol and later: the floor and skirting are the user\'s too', () => {
    const s = stagedDesignState(ds, 'pol', bath)
    expect(s.floorConfigured).toBe(true)
    expect(s.floorTexture).toBe('f.jpg')
    expect(s.skirting).toBeUndefined()
  })
})

describe('hiddenAt: what the banner names', () => {
  const counts = { electricals: 2, fixtures: 1, lights: 3, furniture: 4 }
  it('the kinds that exist and come after the stage, in stage order', () => {
    expect(hiddenAt('pol', bath, counts)).toEqual(['electricals', 'fixtures', 'lights', 'furniture'])
    expect(hiddenAt('chiroq', bath, counts)).toEqual(['furniture'])
    expect(hiddenAt('mebel', bath, counts)).toEqual([])
    expect(hiddenAt('full', bath, counts)).toEqual([])
  })
  it('a kind with nothing in it is not named', () => {
    expect(hiddenAt('pol', bath, { electricals: 0, fixtures: 0, lights: 0, furniture: 1 })).toEqual(['furniture'])
  })
})
