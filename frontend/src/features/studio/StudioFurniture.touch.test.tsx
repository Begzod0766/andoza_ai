/**
 * A finger on a model, on a phone (QA 2026-11-05 #4, re-check R9):
 *   - one finger pressed on a model and dragged moves it, selected first or not;
 *   - two fingers on a model twist it round (the transform toolbar went, 2026-11-20);
 *   - iOS may cancel a touch (a system gesture, a scroll it takes over) with `pointercancel` and no
 *     `pointerup`: the drag never ended, and the camera stayed switched off;
 *   - a second finger landing mid-drag moved the piece to wherever that finger went — now it
 *     turns the drag into a twist instead.
 *
 * Same harness as StudioFurniture.yaw.test.tsx: a real react-three-fiber root driven directly,
 * with a stub renderer. jsdom has no PointerEvent, so mouse events carry the pointer fields.
 */
import { describe, expect, it, vi, afterEach } from 'vitest'
import { act } from '@testing-library/react'
import { useState } from 'react'
import * as THREE from 'three'
import { advance, createRoot, events as pointerEvents, extend, useThree } from '@react-three/fiber'

let fakeGltfScene = new THREE.Group()
function useBox() {
  fakeGltfScene = new THREE.Group()
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial())
  mesh.name = 'seat'
  fakeGltfScene.add(mesh)
}

vi.mock('@react-three/drei', () => ({
  useGLTF: Object.assign(() => ({ scene: fakeGltfScene }), { preload: () => {} }),
  Html: () => null,
}))

import { DraggableFurnitureModels } from './StudioFurniture'
import { useRoomStore } from '@/store/roomStore'

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

const WIDTH = 800
const HEIGHT = 600

afterEach(() => {
  document.body.innerHTML = ''
})

/** A pointer event as a finger sends it. */
function touch(type: string, id: number, x: number, y: number): MouseEvent {
  const ev = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y })
  for (const [k, v] of Object.entries({ offsetX: x, offsetY: y, pointerId: id, pointerType: 'touch' })) {
    Object.defineProperty(ev, k, { value: v, enumerable: true })
  }
  return ev
}

function mountRoom(selected: string | null) {
  useBox()
  useRoomStore.setState({
    furniture: [{ id: 'f1', furniture_id: 'shop-chair', x: 0, y: 0, rotation: 0 }],
    userFurniture: [],
    catalogFurniture: [{ id: 'shop-chair', name_uz: 'Stul', glb_url: '/fake-chair.glb', footprint_w: 100, footprint_d: 100, price_uzs: 1 }] as never,
  })
  const selections: string[] = []
  const controls = { enabled: true }
  function Scene() {
    const [selectedId, setSelectedId] = useState<string | null>(selected)
    return (
      <DraggableFurnitureModels
        controlsRef={{ current: controls as never }}
        roomW={6000}
        roomD={6000}
        toolMode="select"
        selectedId={selectedId}
        onSelectItem={(id) => { selections.push(id); setSelectedId(id) }}
        onDelete={() => {}}
        selectedPart={null}
        onSelectPart={() => {}}
      />
    )
  }
  let scene: THREE.Scene | null = null
  function Grab() { scene = useThree((s) => s.scene); return null }
  const canvas = document.createElement('canvas')
  // The drag raycasts from the canvas's box; jsdom's is all zeros.
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: WIDTH, height: HEIGHT, right: WIDTH, bottom: HEIGHT, x: 0, y: 0, toJSON: () => ({}) })
  document.body.appendChild(canvas)
  const root = createRoot(canvas)
  root.configure({
    gl: stubRenderer, events: pointerEvents, frameloop: 'never',
    size: { width: WIDTH, height: HEIGHT, top: 0, left: 0 },
    // Above the room looking down at it, so a finger's travel is travel across the floor.
    camera: { position: [0, 6, 0.001], rotation: [-Math.PI / 2, 0, 0] },
  })
  act(() => { root.render(<><Grab /><Scene /></>) })
  const meshAt = () => {
    let mesh: THREE.Mesh | null = null
    scene!.traverse((o) => { if (o.name === 'seat' && !((o as THREE.Mesh).material instanceof THREE.ShaderMaterial)) mesh = o as THREE.Mesh })
    scene!.updateMatrixWorld(true)
    return new THREE.Box3().setFromObject(mesh!).getCenter(new THREE.Vector3())
  }
  return { canvas, selections, controls, meshAt, unmount: () => act(() => { root.unmount() }) }
}

const cx = WIDTH / 2, cy = HEIGHT / 2
const send = (target: EventTarget, ev: Event) => act(() => { target.dispatchEvent(ev) })
const stored = () => useRoomStore.getState().furniture[0]

describe('a finger on a model', () => {
  it('a one-finger tap still selects it', () => {
    const r = mountRoom(null)
    send(r.canvas, touch('pointerdown', 1, cx, cy))
    send(r.canvas, touch('pointerup', 1, cx, cy))
    expect(r.selections).toEqual(['f1'])
    r.unmount()
  })

  it('a tap without travel selects it and leaves it where it stood', () => {
    const r = mountRoom(null)
    send(r.canvas, touch('pointerdown', 1, cx, cy))
    send(window, touch('pointermove', 1, cx + 2, cy + 1))
    send(window, touch('pointerup', 1, cx + 2, cy + 1))
    expect(r.selections).toContain('f1')
    expect(stored()).toMatchObject({ x: 0, y: 0, rotation: 0 })
    expect(r.controls.enabled).toBe(true)
    r.unmount()
  })

  it('a one-finger drag moves it even when it was not selected first', () => {
    const r = mountRoom(null)
    send(r.canvas, touch('pointerdown', 1, cx, cy))
    expect(r.controls.enabled).toBe(false)
    send(window, touch('pointermove', 1, cx + 60, cy))
    send(window, touch('pointerup', 1, cx + 60, cy))
    expect(r.selections).toContain('f1')
    expect(stored().x).toBeGreaterThan(100)
    expect(r.controls.enabled).toBe(true)
    r.unmount()
  })

  it('two fingers that start on it twist it, and the camera stays out of it', () => {
    const r = mountRoom(null)
    send(r.canvas, touch('pointerdown', 1, cx, cy))
    send(r.canvas, touch('pointerdown', 2, cx + 100, cy))
    expect(r.controls.enabled).toBe(false)
    // The second finger swings a quarter turn clockwise on screen round the first.
    send(window, touch('pointermove', 2, cx + 71, cy + 71))
    send(window, touch('pointermove', 2, cx, cy + 100))
    act(() => { advance(performance.now()) })
    send(window, touch('pointerup', 2, cx, cy + 100))
    send(window, touch('pointerup', 1, cx, cy))
    // Seen from above, clockwise on screen is a negative turn about +y.
    expect(stored().rotation).toBeCloseTo(-Math.PI / 2, 2)
    expect(Math.abs(stored().x)).toBeLessThan(1)
    expect(Math.abs(stored().y)).toBeLessThan(1)
    expect(r.selections).toContain('f1')
    expect(r.controls.enabled).toBe(true)
    r.unmount()
  })

  it('a drag the system cancels lets go: the piece stays put and the camera comes back', () => {
    const r = mountRoom('f1')
    send(r.canvas, touch('pointerdown', 1, cx, cy))
    expect(r.controls.enabled).toBe(false)
    send(window, touch('pointermove', 1, cx + 120, cy))
    act(() => { advance(performance.now()) })
    send(window, touch('pointercancel', 1, cx + 120, cy))
    act(() => { advance(performance.now()) })
    expect(r.controls.enabled).toBe(true)
    expect(stored()).toMatchObject({ x: 0, y: 0 })
    expect(r.meshAt().x).toBeCloseTo(0, 6)
    // And the next drag is a fresh one, not the stuck one carrying on.
    send(window, touch('pointermove', 1, cx + 200, cy))
    expect(stored()).toMatchObject({ x: 0, y: 0 })
    r.unmount()
  })

  it('a second finger landing mid-drag turns the drag into a twist', () => {
    const r = mountRoom('f1')
    send(r.canvas, touch('pointerdown', 1, cx, cy))
    send(window, touch('pointermove', 1, cx + 60, cy))
    act(() => { advance(performance.now()) })
    const movedTo = r.meshAt().x
    expect(movedTo).toBeGreaterThan(0.1)
    send(r.canvas, touch('pointerdown', 2, cx + 160, cy))
    // A quarter turn the other way: counter-clockwise on screen.
    send(window, touch('pointermove', 2, cx + 60, cy - 100))
    send(window, touch('pointerup', 2, cx + 60, cy - 100))
    send(window, touch('pointerup', 1, cx + 60, cy))
    act(() => { advance(performance.now()) })
    expect(stored().rotation).toBeCloseTo(Math.PI / 2, 2)
    // The second finger's travel never moved the piece.
    expect(stored().x / 1000).toBeCloseTo(movedTo, 1)
    expect(r.controls.enabled).toBe(true)
    r.unmount()
  })

  // Issue #176: a finger that grabbed the chair off its centre made the chair's centre jump to the
  // finger on the first move — a selected armchair "moved an extra ~20 cm" on its own. The piece has
  // to move by the finger's travel, keeping the offset it was grabbed at.
  it('a drag grabbed off-centre keeps the grab offset: the piece moves only as far as the finger', () => {
    const r = mountRoom('f1')
    // ~20 px right of the centre: on the box, ~0.18 m from the chair's centre on the floor.
    const grabX = cx + 20
    send(r.canvas, touch('pointerdown', 1, grabX, cy))
    expect(r.controls.enabled).toBe(false)
    // 8 px: just past the tap threshold (TAP_SLOP_PX), well short of the 20 px offset.
    send(window, touch('pointermove', 1, grabX + 8, cy))
    act(() => { advance(performance.now()) })
    // 8 px of travel is ~0.12 m across this floor; jumping by the grab offset as well would be ~0.4 m.
    expect(Math.abs(r.meshAt().x)).toBeLessThan(0.2)
    send(window, touch('pointerup', 1, grabX + 8, cy))
    expect(stored().x).toBeGreaterThan(0)
    expect(stored().x).toBeLessThan(200)
    expect(Math.abs(stored().y)).toBeLessThan(1)
    r.unmount()
  })

  it('a drag grabbed off-centre and moved back to where it started leaves the piece where it was', () => {
    const r = mountRoom('f1')
    send(r.canvas, touch('pointerdown', 1, cx - 25, cy + 15))
    send(window, touch('pointermove', 1, cx + 40, cy - 30))
    send(window, touch('pointermove', 1, cx - 25, cy + 15))
    send(window, touch('pointerup', 1, cx - 25, cy + 15))
    expect(Math.abs(stored().x)).toBeLessThan(1)
    expect(Math.abs(stored().y)).toBeLessThan(1)
    r.unmount()
  })

  it('a one-finger drag still moves it', () => {
    const r = mountRoom('f1')
    send(r.canvas, touch('pointerdown', 1, cx, cy))
    send(window, touch('pointermove', 1, cx + 60, cy))
    send(window, touch('pointerup', 1, cx + 60, cy))
    expect(stored().x).toBeGreaterThan(100)
    expect(r.controls.enabled).toBe(true)
    r.unmount()
  })
})
