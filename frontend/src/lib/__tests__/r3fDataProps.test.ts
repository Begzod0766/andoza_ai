import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const SRC = join(__dirname, '..', '..')

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) return f === 'node_modules' ? [] : tsxFiles(p)
    return p.endsWith('.tsx') && !p.endsWith('.test.tsx') ? [p] : []
  })
}

// react-three-fiber reads a dashed prop as a nested path: `data-testid` on a <group> sets
// `group.data.testid`, and `data` is undefined, so the whole Canvas throws ("reading 'testid'").
// The admin model preview did exactly that and failed for every model.
const THREE_TAGS = 'group|mesh|primitive|points|line|lineSegments|instancedMesh|sprite|object3D|scene'
const DASHED_ON_THREE = new RegExp(`<(?:${THREE_TAGS})\\b[^>]*\\s(?:data|aria)-[\\w-]+=`)

describe('three.js elements', () => {
  it('carry no data-*/aria-* props (r3f would crash on them)', () => {
    const offenders = tsxFiles(SRC)
      .filter((f) => readFileSync(f, 'utf8').includes('@react-three/'))
      .flatMap((f) => readFileSync(f, 'utf8').split('\n')
        .map((line, i) => (DASHED_ON_THREE.test(line) ? `${f.replace(SRC, '')}:${i + 1}` : null))
        .filter(Boolean))
    expect(offenders).toEqual([])
  })
})
