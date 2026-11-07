import { describe, it, expect } from 'vitest'
import { partFingerprint } from '../labels'
import type { Part } from '@/features/mebel/engine'

const part: Part = {
  id: 'c1-side_left', cabinetId: 'c1', role: 'side_left', material: 'board', materialId: null, thickness: 18,
  finished: { length: 720, width: 560 }, cut: { length: 720, width: 558 }, grain: 'length',
  edges: { L1: { thickness: 2 } as Part['edges']['L1'], L2: null as unknown as Part['edges']['L2'], W1: null as unknown as Part['edges']['W1'], W2: null as unknown as Part['edges']['W2'] },
  qty: 1, placement: { x: 0, y: 0, z: 0, sx: 18, sy: 720, sz: 560 },
  holes: [{ kind: 'confirmat', face: 'A', u: 37, v: 50, diameter: 5, depth: 13 }],
}
const clone = (p: Part): Part => JSON.parse(JSON.stringify(p))

function mutate(what: string): [Part, string] {
  const p = clone(part)
  let name = 'LDSP Oq'
  if (what === 'length') p.finished.length += 1
  if (what === 'width') p.finished.width += 1
  if (what === 'thickness') p.thickness = 16
  if (what === 'material') name = 'LDSP Kulrang'
  if (what === 'grain') p.grain = 'width'
  if (what === 'edge') p.edges.L1 = { thickness: 0.4 } as Part['edges']['L1']
  if (what === 'hole') p.holes![0].u = 38
  return [p, name]
}

describe('partFingerprint', () => {
  it('is 6 base-36 characters and stable for equal input', () => {
    expect(partFingerprint(part, 'LDSP Oq')).toMatch(/^[0-9a-z]{6}$/)
    expect(partFingerprint(clone(part), 'LDSP Oq')).toBe(partFingerprint(part, 'LDSP Oq'))
  })

  it.each(['length', 'width', 'thickness', 'material', 'grain', 'edge', 'hole'])('changes with %s', (what) => {
    const [p, name] = mutate(what)
    expect(partFingerprint(p, name)).not.toBe(partFingerprint(part, 'LDSP Oq'))
  })

  it('a part without holes still fingerprints', () => {
    expect(partFingerprint({ ...clone(part), holes: undefined }, 'LDSP Oq')).toMatch(/^[0-9a-z]{6}$/)
  })
})
