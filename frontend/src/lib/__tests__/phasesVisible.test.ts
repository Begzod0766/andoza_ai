import { describe, it, expect } from 'vitest'
import { RENO_STAGES, visibleStages, initialPhaseFor, initialViewStage, isPlumbingPhase } from '../phases'

describe('Quvurlar and Jihozlar (spec 2026-11-18): Santexnika split in two', () => {
  it('a bathroom goes pipes → plaster … installation → fixtures → lights → furniture', () => {
    expect(visibleStages('hammom').map((s) => s.key)).toEqual(
      ['quvurlar', 'suvoq', 'shpaklovka', 'boyoq', 'pol', 'montaj', 'jihozlar', 'chiroq', 'mebel'])
    expect(RENO_STAGES.some((s) => (s.key as string) === 'santexnika')).toBe(false)
  })
  it('both show in a bathroom and a kitchen only', () => {
    for (const kind of ['hammom', 'oshxona']) {
      const keys = visibleStages(kind).map((s) => s.key)
      expect(keys).toContain('quvurlar')
      expect(keys).toContain('jihozlar')
    }
    for (const kind of ['mehmonxona', undefined]) {
      expect(visibleStages(kind).map((s) => s.key)).toEqual(['suvoq', 'shpaklovka', 'boyoq', 'pol', 'montaj', 'chiroq', 'mebel'])
    }
  })
  it('isPlumbingPhase: the two plumbing stages only', () => {
    expect(isPlumbingPhase('quvurlar')).toBe(true)
    expect(isPlumbingPhase('jihozlar')).toBe(true)
    expect(isPlumbingPhase('santexnika')).toBe(false)
    expect(isPlumbingPhase('mebel')).toBe(false)
  })
})

describe('the stage a link opens at', () => {
  it('initialViewStage: a valid ?phase= draws that stage; anything else the finished room', () => {
    expect(initialViewStage({ phaseParam: 'suvoq', roomKind: 'hammom' })).toBe('suvoq')
    expect(initialViewStage({ phaseParam: 'santexnika', roomKind: 'hammom' })).toBe('jihozlar')
    expect(initialViewStage({ phaseParam: 'quvurlar', roomKind: 'yotoqxona' })).toBe('full')
    expect(initialViewStage({ phaseParam: null, roomKind: 'hammom' })).toBe('full')
    expect(initialViewStage({ phaseParam: 'suvoq', roomKind: 'hammom', tab: 'mebel' })).toBe('full')
  })
  it('an old ?phase=santexnika opens Jihozlar in a bathroom, the default in a bedroom', () => {
    expect(initialPhaseFor({ phaseParam: 'santexnika', roomKind: 'hammom' })).toBe('jihozlar')
    expect(initialPhaseFor({ phaseParam: 'santexnika', roomKind: 'oshxona' })).toBe('jihozlar')
    expect(initialPhaseFor({ phaseParam: 'santexnika', roomKind: 'yotoqxona' })).toBe('mebel')
  })
  it('?phase=quvurlar and ?phase=jihozlar open their stage where the room has it', () => {
    expect(initialPhaseFor({ phaseParam: 'quvurlar', roomKind: 'hammom' })).toBe('quvurlar')
    expect(initialPhaseFor({ phaseParam: 'jihozlar', roomKind: 'hammom' })).toBe('jihozlar')
    expect(initialPhaseFor({ phaseParam: 'quvurlar', roomKind: 'yotoqxona' })).toBe('mebel')
  })
  it('no link: the last stage, Mebel, so the studio opens on the finished room (spec 2026-11-18)', () => {
    expect(initialPhaseFor({ phaseParam: null, roomKind: undefined })).toBe('mebel')
    expect(initialPhaseFor({ phaseParam: null, roomKind: 'hammom' })).toBe('mebel')
  })
  it('other links and tabs as before', () => {
    expect(initialPhaseFor({ phaseParam: 'suvoq', roomKind: 'yotoqxona' })).toBe('suvoq')
    expect(initialPhaseFor({ phaseParam: 'suvoq', roomKind: undefined, tab: 'mebel' })).toBe('mebel')
    expect(initialPhaseFor({ phaseParam: 'suvoq', roomKind: undefined, tab: 'chiroq' })).toBe('chiroq')
  })
})

describe('a new room opens at its first stage (QA 2026-11-18 #4)', () => {
  it('a bathroom or kitchen opens at Quvurlar, any other room at Suvoq', async () => {
    const { newRoomStudioPath } = await import('../phases')
    expect(newRoomStudioPath('r1', 'hammom')).toBe('/studio/r1/ichkarida?phase=quvurlar')
    expect(newRoomStudioPath('r1', 'oshxona')).toBe('/studio/r1/ichkarida?phase=quvurlar')
    expect(newRoomStudioPath('r1', 'yotoqxona')).toBe('/studio/r1/ichkarida?phase=suvoq')
    expect(newRoomStudioPath('r1', 'bolalar')).toBe('/studio/r1/ichkarida?phase=suvoq')
    expect(newRoomStudioPath('r1', null)).toBe('/studio/r1/ichkarida?phase=suvoq')
  })
  it('the studio honours that link: a bathroom opens its panel and its 3D at Quvurlar', () => {
    expect(initialPhaseFor({ phaseParam: 'quvurlar', roomKind: 'hammom' })).toBe('quvurlar')
    expect(initialViewStage({ phaseParam: 'quvurlar', roomKind: 'hammom' })).toBe('quvurlar')
  })
})
