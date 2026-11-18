import { describe, it, expect } from 'vitest'
import { RENO_STAGES, visibleStages, initialPhaseFor, isPlumbingPhase } from '../phases'

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
  it('an old ?phase=santexnika opens Jihozlar in a bathroom, the default in a bedroom', () => {
    expect(initialPhaseFor({ phaseParam: 'santexnika', roomKind: 'hammom' })).toBe('jihozlar')
    expect(initialPhaseFor({ phaseParam: 'santexnika', roomKind: 'oshxona' })).toBe('jihozlar')
    expect(initialPhaseFor({ phaseParam: 'santexnika', roomKind: 'yotoqxona' })).toBe('boyoq')
  })
  it('?phase=quvurlar and ?phase=jihozlar open their stage where the room has it', () => {
    expect(initialPhaseFor({ phaseParam: 'quvurlar', roomKind: 'hammom' })).toBe('quvurlar')
    expect(initialPhaseFor({ phaseParam: 'jihozlar', roomKind: 'hammom' })).toBe('jihozlar')
    expect(initialPhaseFor({ phaseParam: 'quvurlar', roomKind: 'yotoqxona' })).toBe('boyoq')
  })
  it('other links and tabs as before', () => {
    expect(initialPhaseFor({ phaseParam: 'suvoq', roomKind: 'yotoqxona' })).toBe('suvoq')
    expect(initialPhaseFor({ phaseParam: null, roomKind: undefined })).toBe('boyoq')
    expect(initialPhaseFor({ phaseParam: 'suvoq', roomKind: undefined, tab: 'mebel' })).toBe('mebel')
    expect(initialPhaseFor({ phaseParam: 'suvoq', roomKind: undefined, tab: 'chiroq' })).toBe('chiroq')
  })
})
