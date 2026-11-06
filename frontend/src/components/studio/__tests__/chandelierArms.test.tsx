/**
 * The chandelier has to read as ONE fixture. Its six bulbs each sat on a short vertical stick with
 * nothing joining them to the centre, so from inside the room it looked like six floating lamps
 * around the cord. Every bulb now hangs on an arm from the hub — and in a low room, where the cord
 * is shortened until the hub sits just under the ceiling (hangingDropM), no part may poke through it.
 *
 * Built as a real three.js scene (react-three-fiber root, stub renderer) so the check is on the
 * world-space geometry that is actually drawn, not on the JSX.
 */
import { describe, expect, it } from 'vitest'
import { act } from '@testing-library/react'
import * as THREE from 'three'
import { createRoot, extend, useThree } from '@react-three/fiber'
import { LightFixture } from '../LightFixtures'
import { hangingDropM, lightType } from '@/lib/lightCatalog'

extend(THREE)

function stubRenderer(canvas: HTMLCanvasElement) {
  return {
    domElement: canvas,
    render: () => {}, setSize: () => {}, setPixelRatio: () => {}, setClearColor: () => {},
    setAnimationLoop: () => {}, getContext: () => null, dispose: () => {},
    outputColorSpace: '', toneMapping: 0,
    shadowMap: { enabled: false, type: 0, needsUpdate: false },
    info: { autoReset: true, reset: () => {}, render: { frame: 0 } },
    capabilities: { isWebGL2: true },
  } as unknown as THREE.WebGLRenderer
}

const t = lightType('chandelier')
const light = { id: 'c1', type: 'chandelier', xMm: 0, zMm: 0 } as never

/** The chandelier's meshes, in its own frame (origin = where the cord meets the body). */
function renderChandelier(drop: number) {
  let scene: THREE.Scene | null = null
  function Grab() { scene = useThree((s) => s.scene); return null }
  const canvas = document.createElement('canvas')
  const root = createRoot(canvas)
  root.configure({ gl: stubRenderer, frameloop: 'never', size: { width: 100, height: 100, top: 0, left: 0 } })
  act(() => { root.render(<><Grab /><LightFixture light={light} on drop={drop} /></>) })
  scene!.updateMatrixWorld(true)
  const meshes: THREE.Mesh[] = []
  scene!.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh) })
  const isBulb = (m: THREE.Mesh) => {
    const mat = m.material as THREE.MeshStandardMaterial
    return mat.emissiveIntensity > 0 && mat.emissive.getHex() !== 0
  }
  const centre = (m: THREE.Mesh) => new THREE.Vector3().setFromMatrixPosition(m.matrixWorld)
  /** The two end points of a cylinder, world space: it runs along its own Y. */
  const ends = (m: THREE.Mesh) => {
    const half = (m.geometry as THREE.CylinderGeometry).parameters.height / 2
    return [new THREE.Vector3(0, half, 0), new THREE.Vector3(0, -half, 0)].map((p) => p.applyMatrix4(m.matrixWorld))
  }
  return {
    meshes,
    bulbs: meshes.filter(isBulb).map(centre),
    hub: meshes.find((m) => m.name === 'chandelier-hub'),
    arms: meshes.filter((m) => m.name === 'chandelier-arm'),
    ends,
    unmount: () => act(() => { root.unmount() }),
  }
}

describe('chandelier', () => {
  it('keeps its six bulbs where the emitters are', () => {
    const r = renderChandelier(0.6)
    expect(r.bulbs).toHaveLength(6)
    for (const b of r.bulbs) {
      expect(Math.hypot(b.x, b.z)).toBeCloseTo(t.sizeM.w / 2, 5)
      expect(b.y).toBeCloseTo(-t.sizeM.h * 0.55, 5)
    }
    r.unmount()
  })

  it('joins every bulb to the hub with an arm whose ends meet the hub and the candle', () => {
    const r = renderChandelier(0.6)
    expect(r.hub).toBeDefined()
    const hubBox = new THREE.Box3().setFromObject(r.hub!)
    const hubR = (hubBox.max.x - hubBox.min.x) / 2
    expect(r.arms.length).toBeGreaterThanOrEqual(6)
    const served = new Set<number>()
    for (const arm of r.arms) {
      const [a, b] = r.ends(arm)
      // One end at the hub (inside its radius and its height), the other at a candle.
      const atHub = (p: THREE.Vector3) =>
        Math.hypot(p.x, p.z) <= hubR + 0.01 && p.y >= hubBox.min.y - 0.01 && p.y <= hubBox.max.y + 0.01
      const inner = atHub(a) ? a : atHub(b) ? b : null
      expect(inner, 'an arm end meets the hub').not.toBeNull()
      const outer = inner === a ? b : a
      const nearest = r.bulbs
        .map((bulb, i) => ({ i, d: bulb.distanceTo(outer) }))
        .sort((p, q) => p.d - q.d)[0]
      expect(nearest.d, 'the other arm end meets a candle').toBeLessThan(0.1)
      // Arms reach out and down from the hub, never up toward the ceiling.
      expect(outer.y).toBeLessThan(inner.y)
      served.add(nearest.i)
    }
    expect(served.size).toBe(6)
    r.unmount()
  })

  it('nothing reaches above the ceiling, even with the cord shortened in a 2.4 m room', () => {
    for (const drop of [0, 0.02, hangingDropM({}, t, 2.4), 0.6]) {
      const r = renderChandelier(drop)
      for (const m of r.meshes) {
        const top = new THREE.Box3().setFromObject(m).max.y
        // The ceiling is `drop` above the body's origin; only the cord may reach it.
        expect(top, `${m.name || 'mesh'} at drop ${drop}`).toBeLessThanOrEqual(drop + 1e-6)
        if (m.name !== 'cord') expect(top).toBeLessThanOrEqual(1e-6)
      }
      // And it keeps its catalogue size.
      const box = new THREE.Box3()
      for (const m of r.meshes) if (m.name !== 'cord') box.expandByObject(m)
      expect(box.max.x - box.min.x).toBeLessThanOrEqual(t.sizeM.w + 0.11)
      expect(-box.min.y).toBeLessThanOrEqual(t.sizeM.h + 1e-6)
      r.unmount()
    }
  })
})
