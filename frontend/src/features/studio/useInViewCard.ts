import { useRef, type RefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { cardShift } from './viewportClamp'

/** How far from the view's edge a shifted card stops, px. */
const EDGE_MARGIN_PX = 8

/**
 * Keeps a drei <Html> card inside the canvas (Begzod0766/andoza_ai#185): each
 * frame, after drei has placed it over its model, the card is measured and
 * nudged back in by a transform on the card itself. Written straight to the
 * element, as drei does, so following a drag costs no re-render.
 */
export function useInViewCard(ref: RefObject<HTMLElement | null>) {
  const gl = useThree((s) => s.gl)
  const shift = useRef({ x: 0, y: 0 })
  const shifted = useRef<HTMLElement | null>(null)
  useFrame(() => {
    const el = ref.current
    if (!el) return
    // A card shown afresh (deselected, then selected again) starts unshifted.
    if (el !== shifted.current) { shifted.current = el; shift.current = { x: 0, y: 0 } }
    const next = cardShift(el.getBoundingClientRect(), shift.current, gl.domElement.getBoundingClientRect(), EDGE_MARGIN_PX)
    if (next.x === shift.current.x && next.y === shift.current.y) return
    shift.current = next
    el.style.transform = next.x || next.y ? `translate(${next.x}px, ${next.y}px)` : ''
  })
}
