/**
 * WallOpenings — the interactive editing layer for windows & doors, rendered
 * on top of the (visual-only) WindowFrames/DoorFrames. It owns:
 *   • selection (tap an opening once to select it — the width/height/sill/
 *     style/delete panel lives in DoorLeaves.tsx's WindowEditor/DoorEditor,
 *     which opens automatically on selection, so this layer has no toolbar
 *     of its own)
 *   • free-drag move (once selected, press-and-drag anywhere on the opening
 *     to reposition it along the wall in real time; window = X+Y, door = X
 *     only, bottom on floor)
 *   • live meter dimension labels while selected (window: 4, door: 2) —
 *     shown as soon as the opening is selected, not only while dragging
 *   • Canva-style magenta alignment guides + snapping to sibling openings
 *   • edge clamping + no-overlap (the maths: lib/openingDrag)
 *
 * Everything is expressed in each wall's LOCAL frame — `position` (mm along the
 * wall from its left edge) and `sill_height` (mm above the floor). A drag only
 * ever writes those two numbers back via updateElement(wallId, …), so an
 * opening can never leave its wall.
 *
 * Wall frames and positions come from lib/openingFrames — the frame RoomScene
 * cuts the holes in, with auto-placed openings RESOLVED to where they are
 * drawn. Placing the hit plane from the raw stored position in a frame of its
 * own put tappable doors where none was drawn (#182).
 *
 * Perf note: a pointer drag commits to the store via updateElement exactly
 * ONCE, on pointerup — never on every pointermove. Live drag position lives
 * in `liveDragRef` (see below) and is read directly during render (already
 * re-triggered every pointermove by the pre-existing `setGuides` call), so
 * the dragged opening's own visuals stay fully live without touching
 * Zustand's `geometry` — which every other 3D/panel consumer also reads —
 * on every frame of the gesture.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { formatDecimal } from '@/lib/utils'
import { useTranslation } from 'react-i18next'
import * as THREE from 'three'
import { Html } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import type { RoomGeometry, WallElement } from '@/store/roomStore'
import { liveOpeningDrag } from '@/lib/liveOpeningDrag'
import { clearPosition, dragOpening } from '@/lib/openingDrag'
import { alongWall, openingCentreOnWall, openingWallFrames, pointOnWall, type OpeningWallFrame } from '@/lib/openingFrames'
import { useHoldToDelete } from "@/hooks/useHoldToDelete";
import { LEAF_FACE_DEPTH } from "./DoorLeaves";
import { wallNumber } from "@/lib/wallLabel";

export interface OpeningSel { wallId: string; elId: string }

/** A wall in the renderer's frame (lib/openingFrames), plus the plane a drag
 *  ray is intersected with. */
interface WallDef extends OpeningWallFrame {
  plane: THREE.Plane
}

// Keyboard nudge step for a selected opening's position — matches the
// resize steppers' existing ±100mm convention (there is no drag "grid" for
// position; the pointer drag is continuous).
const KEYBOARD_NUDGE_MM = 100

const s = 1 / 1000

export function WallOpenings({
  geometry, W, D, H, hiddenWalls, selected, onSelect, updateElement, removeElement, onInteracting, openMenu, armedId, onArm,
}: {
  geometry: RoomGeometry
  W: number; D: number; H: number
  hiddenWalls?: ReadonlySet<string>
  selected: OpeningSel | null
  onSelect: (sel: OpeningSel | null) => void
  updateElement: (wallId: string, elId: string, patch: Partial<Omit<WallElement, 'id'>>) => void
  removeElement: (wallId: string, elId: string) => void
  onInteracting: (active: boolean) => void
  /** Opens the tapped opening's own ring of designs, where it was tapped. */
  openMenu?: (kind: 'door' | 'window', wallId: string, elId: string, e: ThreeEvent<MouseEvent>) => void
  /** The opening a double tap has armed for dragging. Only this one moves. */
  armedId?: string | null
  /** Arms an opening for dragging, from the hold menu's "Ko'chirish". */
  onArm?: (wallId: string, elId: string) => void
}) {
  const { t } = useTranslation()
  // The walls as the renderer draws them — the legacy A/B/C/D table or the
  // polygon's own edges, whichever RoomScene uses for this room — each with
  // its openings resolved to where they are drawn (lib/openingFrames).
  const defs = useMemo(() => {
    const out: Record<string, WallDef> = {}
    for (const [id, f] of Object.entries(openingWallFrames(geometry))) {
      const normal = new THREE.Vector3(f.nX, 0, f.nZ)
      out[id] = { ...f, plane: new THREE.Plane(normal, -(f.nX * f.x0 + f.nZ * f.z0)) }
    }
    return out
  }, [geometry])
  const dragging = useRef(false)
  const [guides, setGuides] = useState<Array<{ kind: 'h' | 'v'; wallId: string; at: number }>>([])

  // ── Live-drag position (perf) ───────────────────────────────────────
  // The whole gesture writes to the store exactly ONCE, on pointerup.
  // While dragging, the live position/sill_height live only in this ref —
  // never in Zustand — so every pointermove does NOT trigger a full
  // `geometry` rebuild (which would cascade re-renders through every other
  // consumer of `geometry`: ThreeDPage, RoomScene, DesignPanel's
  // WallSection/SuvoqSection/WallPanelGenerator, …). The `setGuides(g)` call
  // in `onMove` already re-renders this component on every pointermove (it
  // always did, even before this fix), so reading this ref during render
  // is enough to keep the dragged opening's visuals — hit-plane, selection
  // border, dimension labels — perfectly live without any extra store write
  // or extra re-render source.
  const liveDragRef = useRef<{ wallId: string; elId: string; position: number; sill_height: number } | null>(null)

  // Selection-border plane geometry is only ever needed for the single
  // currently-selected opening, so a one-slot cache keyed on its (width,
  // height) is enough to stop `new THREE.PlaneGeometry(...)` from being
  // reallocated on every re-render while dragging (mirrors the per-segment
  // memoization WallComponents.tsx uses — this can't be a real `useMemo`
  // because the geometry is built inside a `.map()` callback, not a
  // component, so hooks aren't available here).
  const edgesPlaneCache = useRef<{ key: string; geo: THREE.PlaneGeometry } | null>(null)
  function getEdgesPlane(widthM: number, heightM: number): THREE.PlaneGeometry {
    const key = `${widthM}:${heightM}`
    const cached = edgesPlaneCache.current
    if (cached && cached.key === key) return cached.geo
    cached?.geo.dispose()
    const geo = new THREE.PlaneGeometry(widthM, heightM)
    edgesPlaneCache.current = { key, geo }
    return geo
  }
  // Dispose the last cached instance when this layer unmounts (e.g. leaving
  // the 3D view) — the per-key disposal inside getEdgesPlane only handles
  // the "dimensions changed" case, not final teardown.
  useEffect(() => () => { edgesPlaneCache.current?.geo.dispose() }, [])

  // ── Drag maths (lib/openingDrag) ─────────────────────────────────────
  // Where on the opening the pointer went down, mm from its centre (along
  // the wall, and up). Without it the opening's CENTRE jumped to the pointer
  // on the first move, so grabbing a door near its edge and nudging it 1 cm
  // threw it up to half its width.
  const grabRef = useRef<{ alongMm: number; upMm: number }>({ alongMm: 0, upMm: 0 })

  /** Hit point of a pointer ray on the wall, mm along it and up; null if the
   *  ray runs parallel to the wall. */
  function pointerOnWall(e: ThreeEvent<PointerEvent>, wd: WallDef): { alongMm: number; upMm: number } | null {
    const hit = new THREE.Vector3()
    if (!e.ray?.intersectPlane(wd.plane, hit)) return null
    return { alongMm: alongWall(wd, hit.x, hit.z) * 1000, upMm: hit.y * 1000 }
  }

  /** The wall's other openings, resolved, like the openings themselves: an
   *  auto sibling is where it is drawn. Borrowed ones are another room's. */
  const siblingsOf = (wd: WallDef, el: WallElement) => wd.elements.filter((e) => e.id !== el.id && !e.borrowedFrom)

  function onDown(e: ThreeEvent<PointerEvent>, wd: WallDef, el: WallElement) {
    e.stopPropagation()
    // Dragging takes two taps to arm — see `armedId`. A single tap is for
    // looking at what the opening could be, and a finger resting on a door
    // and sliding a little used to walk it along the wall.
    if (armedId !== el.id) return
    dragging.current = true
    const p = pointerOnWall(e, wd)
    grabRef.current = p
      ? { alongMm: p.alongMm - (el.position + el.width / 2), upMm: p.upMm - (el.sill_height + el.height / 2) }
      : { alongMm: 0, upMm: 0 }
    onInteracting(true)
    ;(e.target as Element)?.setPointerCapture?.(e.pointerId)
  }
  function onMove(e: ThreeEvent<PointerEvent>, wd: WallDef, el: WallElement) {
    if (!dragging.current || armedId !== el.id) return
    e.stopPropagation()
    const p = pointerOnWall(e, wd)
    if (!p) return
    // Collision/edge clamping (dragOpening) still runs on every pointermove
    // — that's cheap and drives the live visual feedback below. What no
    // longer happens here is a store write: the result goes into a ref, not
    // into `updateElement`, so this does not touch `geometry` at all.
    const { position, sill_height, guides: found } = dragOpening(
      el, siblingsOf(wd, el), wd.lengthM * 1000, H * 1000,
      p.alongMm - grabRef.current.alongMm, p.upMm - grabRef.current.upMm,
    )
    const g = found.map((x) => ({ ...x, wallId: wd.wallId }))
    liveDragRef.current = { wallId: wd.wallId, elId: el.id, position, sill_height }
    // Second write target — see liveOpeningDrag.ts's header comment. Same
    // value, same moment, so WindowFrames/DoorFrames/OpeningLeaves never
    // desync from WallOpenings' own hit-plane/selection border/labels.
    liveOpeningDrag.current = { wallId: wd.wallId, elId: el.id, position, sill_height }
    setGuides(g)
  }
  function onUp(e: ThreeEvent<PointerEvent>) {
    if (!dragging.current) return
    dragging.current = false
    onInteracting(false)
    setGuides([])
    // The ONE store write for the whole drag gesture — the final position.
    const live = liveDragRef.current
    if (live) updateElement(live.wallId, live.elId, { position: live.position, sill_height: live.sill_height, positionAuto: false })
    liveDragRef.current = null
    liveOpeningDrag.current = null
    ;(e.target as Element)?.releasePointerCapture?.(e.pointerId)
  }

  const { bind: bindHold, wasHeld } = useHoldToDelete()

  const walls = geometry.walls.filter((w) => defs[w.id] && !hiddenWalls?.has(w.id))

  return (
    <>
      {walls.flatMap((w) => {
        const wd = defs[w.id]
        // Resolved positions — the ones the hole, lining and leaf are drawn at.
        return wd.elements.map((el) => {
          if (el.type !== 'deraza' && el.type !== 'eshik' && el.type !== 'balkon') return null
          // Cut here, drawn and edited from its own room (lib/flatOpenings).
          if (el.borrowedFrom) return null
          const isDoor = el.type === 'eshik'
          const isSel = selected?.wallId === w.id && selected?.elId === el.id
          // While THIS element is the one being dragged, render from the
          // live ref instead of the (intentionally stale, until pointerup)
          // store value — everything below reads `liveEl`, never `el`, for
          // anything position/sill_height related.
          const live = liveDragRef.current
          const liveEl: WallElement = live && live.wallId === w.id && live.elId === el.id
            ? { ...el, position: live.position, sill_height: live.sill_height }
            : el
          // In front of the LEAF, not of the wall. The leaf hangs at the back
          // of a 200 mm niche, so an overlay pushed 20 mm off the wall face
          // floated the better part of a foot in front of the door — which is
          // what the selection border being "in a different place from the
          // door" was. 20 mm of clearance, measured from where the leaf
          // actually is.
          const [px, py, pz] = openingCentreOnWall(
            wd, liveEl,
            0.02 - LEAF_FACE_DEPTH[isDoor ? 'door' : 'window'],
          )
          const hold = bindHold({
            label: el.type === 'eshik' ? t('studio.shared.eshik') : t('studio.shared.deraza'),
            onDelete: () => { removeElement(w.id, el.id); if (isSel) onSelect(null) },
            // Hold → "Ko'chirish": select and arm it, so the next drag walks
            // it along the wall (a door stays on the floor; a window also
            // moves up and down). The double tap still arms it too.
            onMove: onArm ? () => { onSelect({ wallId: w.id, elId: el.id }); onArm(w.id, el.id) } : undefined,
          })
          return (
            <group key={`op-${w.id}-${el.id}`}>
              {/* Invisible (faint when selected) hit plane for select + drag */}
              <mesh
                position={[px, py, pz]}
                rotation={[0, wd.yaw, 0]}
                onClick={(e) => {
                  e.stopPropagation()
                  // A hold that just put the delete button up is not a tap.
                  if (wasHeld()) return
                  onSelect({ wallId: w.id, elId: el.id })
                  // ...and offer what this opening could be. This plane sits
                  // in front of the leaf, so it — not the leaf's own handler —
                  // is what a tap on a door actually lands on.
                  openMenu?.(isDoor ? 'door' : 'window', w.id, el.id, e)
                }}
                onPointerDown={(e) => {
                  hold.onPointerDown(e)
                  onDown(e, wd, el)
                }}
                onPointerMove={(e) => onMove(e, wd, el)}
                onPointerUp={onUp}
                onPointerCancel={onUp}
              >
                <planeGeometry args={[el.width * s, el.height * s]} />
                {/* Never tinted: a selected opening is marked by its edge lines below. */}
                <meshBasicMaterial color="#2E5BFF" transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
              </mesh>

              {/* Keyboard path to mesh selection: three.js meshes have no
                  native DOM focus, so this renders a real (invisible)
                  <button> anchored at the opening's centre via <Html>. Tab
                  reaches it, Enter/Space is the browser's native button
                  activation (calling the same onSelect the mesh's onClick
                  uses), arrows nudge position via the same updateElement the
                  drag handler calls, and Delete/Backspace calls
                  removeElement directly — independent of the width/height/
                  sill/style/delete panel that DoorLeaves.tsx's
                  WindowEditor/DoorEditor already shows on selection. */}
              <Html position={[px, py, pz]} center zIndexRange={[200, 0]} style={{ pointerEvents: 'none' }}>
                <button
                  type="button"
                  aria-label={t('studio.opening.aria', { name: isDoor ? t('studio.shared.eshik') : el.type === 'balkon' ? t('studio.shared.balkon_eshigi') : t('studio.shared.deraza'), wall: wallNumber(w.id) })}
                  // Both stops matter, and for a reason that is easy to miss:
                  // R3F listens on a DIV that is this button's ANCESTOR, and
                  // its default hit test reads `offsetX/offsetY` — which are
                  // relative to the EVENT TARGET. From a 28 px button those
                  // are 0..28 whatever the screen size, so an event that
                  // leaks through is raycast at roughly the viewport's
                  // top-left corner and opens the ring for whatever surface
                  // happens to be there. That is "tapping a door opens the
                  // ceiling's menu", with a dead zone over the door's centre
                  // where the tap seems to do nothing.
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); onSelect({ wallId: w.id, elId: el.id }) }}
                  onKeyDown={(e) => {
                    // The drag's rule: on the wall, clear of the other
                    // openings, and explicit from now on (an auto sibling is
                    // laid out around it, never moves it).
                    const nudge = (delta: number) => updateElement(w.id, el.id, {
                      position: clearPosition(el, siblingsOf(wd, el), wd.lengthM * 1000, el.position + delta),
                      positionAuto: false,
                    })
                    switch (e.key) {
                      case 'ArrowLeft':
                      case 'ArrowUp':
                        e.preventDefault()
                        nudge(-KEYBOARD_NUDGE_MM)
                        break
                      case 'ArrowRight':
                      case 'ArrowDown':
                        e.preventDefault()
                        nudge(KEYBOARD_NUDGE_MM)
                        break
                      case 'Delete':
                      case 'Backspace':
                        e.preventDefault()
                        removeElement(w.id, el.id)
                        if (isSel) onSelect(null)
                        break
                    }
                  }}
                  // Keyboard only. A finger or a mouse goes straight through to
                  // the hit plane behind: this button sits on the door's
                  // centre, which is exactly where people tap, and catching
                  // the tap here meant no ring, no double-tap arming and so no
                  // drag. `pointer-events: none` leaves Tab focus and
                  // Enter/Space untouched.
                  tabIndex={0}
                  style={{
                    width: 28, height: 28, padding: 0, margin: 0,
                    background: 'transparent', border: 'none',
                    pointerEvents: 'none',
                  }}
                />
              </Html>

              {/* Selection border */}
              {isSel && (
                <lineSegments position={[px, py, pz]} rotation={[0, wd.yaw, 0]}>
                  <edgesGeometry args={[getEdgesPlane(el.width * s, el.height * s)]} />
                  {/* Amber once a double tap has armed it: the border is the
                      only thing that can say "this one will move if you drag
                      it", and a mode nobody can see is a mode nobody trusts. */}
                  <lineBasicMaterial color={armedId === el.id ? '#F59E0B' : '#2E5BFF'} />
                </lineSegments>
              )}

              {/* Live meter dimension labels — shown as soon as the opening
                  is selected (matching the ceiling-lights behaviour), and
                  already reads `liveEl`, so they keep updating live once a
                  drag starts without needing a separate "while dragging"
                  gate. Width/height/sill/style/delete live in DoorLeaves.tsx's
                  WindowEditor/DoorEditor panel, not here. */}
              {isSel && (
                <DimensionLabels wd={wd} el={liveEl} W={W} D={D} H={H} isDoor={isDoor} />
              )}
            </group>
          )
        })
      })}

      {/* Magenta alignment guides across the wall */}
      {guides.map((g, i) => {
        const wd = defs[g.wallId]
        if (!wd) return null
        if (g.kind === 'h') {
          // horizontal line across the wall at height at/1000
          const y = g.at * s
          const a = pointOnWall(wd, 0, y, 0.03)
          const b = pointOnWall(wd, wd.lengthM, y, 0.03)
          return <GuideLine key={`g${i}`} a={a} b={b} />
        }
        // vertical line at along = at/1000, full height
        const along = g.at * s
        const a = pointOnWall(wd, along, 0, 0.03)
        const b = pointOnWall(wd, along, H, 0.03)
        return <GuideLine key={`g${i}`} a={a} b={b} />
      })}
    </>
  )
}

function GuideLine({ a, b, color = '#FF2E9A' }: { a: [number, number, number]; b: [number, number, number]; color?: string }) {
  // Built as a real THREE.Line and mounted via <primitive> to sidestep the
  // JSX intrinsic `<line>` colliding with the DOM SVG line typings.
  const obj = useMemo(() => {
    const g = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(a[0], a[1], a[2]),
      new THREE.Vector3(b[0], b[1], b[2]),
    ])
    return new THREE.Line(g, new THREE.LineBasicMaterial({ color }))
  }, [a, b, color])
  return <primitive object={obj} />
}

/** The dimension lines + meter labels: window → 4 (left/right/floor/ceiling),
 *  door → 2 (left/right). */
function DimensionLabels({ wd, el, H, isDoor }: { wd: WallDef; el: WallElement; W: number; D: number; H: number; isDoor: boolean }) {
  const leftM = el.position * s
  const rightM = wd.lengthM - (el.position + el.width) * s
  const floorM = el.sill_height * s
  const ceilM = H - (el.sill_height + el.height) * s
  const cx = (el.position + el.width / 2) * s
  const cy = (el.sill_height + el.height / 2) * s
  const leftEdge = el.position * s
  const rightEdge = (el.position + el.width) * s
  const botY = el.sill_height * s
  const topY = (el.sill_height + el.height) * s

  const items: Array<{ a: [number, number, number]; b: [number, number, number]; mid: [number, number, number]; val: number }> = [
    { a: pointOnWall(wd, 0, cy, 0.03), b: pointOnWall(wd, leftEdge, cy, 0.03), mid: pointOnWall(wd, leftEdge / 2, cy, 0.05), val: leftM },
    { a: pointOnWall(wd, rightEdge, cy, 0.03), b: pointOnWall(wd, wd.lengthM, cy, 0.03), mid: pointOnWall(wd, (rightEdge + wd.lengthM) / 2, cy, 0.05), val: rightM },
  ]
  if (!isDoor) {
    items.push(
      { a: pointOnWall(wd, cx, 0, 0.03), b: pointOnWall(wd, cx, botY, 0.03), mid: pointOnWall(wd, cx, botY / 2, 0.05), val: floorM },
      { a: pointOnWall(wd, cx, topY, 0.03), b: pointOnWall(wd, cx, H, 0.03), mid: pointOnWall(wd, cx, (topY + H) / 2, 0.05), val: ceilM },
    )
  }

  return (
    <>
      {items.map((it, i) => (
        <group key={i}>
          <GuideLine a={it.a} b={it.b} />
          {/* A label, not a control: without `pointerEvents: 'none'` an <Html>
              is fully hit-testable, and these sit over the room during exactly
              the drag whose pointermoves they would swallow. */}
          <Html position={it.mid} center zIndexRange={[210, 0]} style={{ pointerEvents: 'none' }}>
            <div style={{ background: '#1A2340', color: 'white', fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 6, whiteSpace: 'nowrap' }}>
              {formatDecimal(Math.max(0, it.val), 2)} m
            </div>
          </Html>
        </group>
      ))}
    </>
  )
}
