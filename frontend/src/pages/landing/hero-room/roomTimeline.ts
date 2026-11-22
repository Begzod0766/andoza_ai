/**
 * The hero's room: geometry and timeline.
 *
 * A small bedroom is drawn once, in about seven seconds, the way the app builds
 * one: the floor plan is traced, the walls rise, wallpaper and laminate go on,
 * the furniture lands, and the prices pin onto what they belong to. Everything
 * here is pure (metres in, SVG units out) so the component only paints frames.
 */

/** SVG units per metre. */
export const S = 100
const COS = 0.8660254
const SIN = 0.5

/** Room size in metres: width along x, depth along y, wall height. */
export const ROOM = { w: 4.2, d: 3.4, h: 2.7 } as const

export type Pt = [number, number]

/** Isometric projection: x runs right-down, y left-down, z straight up. */
export function iso(x: number, y: number, z: number): Pt {
  return [(x - y) * COS * S, (x + y) * SIN * S - z * S]
}

/** The three faces of a box a viewer standing at +x,+y sees. */
export function boxFaces(x: number, y: number, z: number, dx: number, dy: number, dz: number) {
  const X = x + dx
  const Y = y + dy
  const Z = z + dz
  return {
    top: [iso(x, y, Z), iso(X, y, Z), iso(X, Y, Z), iso(x, Y, Z)],
    front: [iso(x, Y, z), iso(X, Y, z), iso(X, Y, Z), iso(x, Y, Z)],
    side: [iso(X, y, z), iso(X, Y, z), iso(X, Y, Z), iso(X, y, Z)],
  }
}

export const points = (pts: Pt[]) => pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')

export interface Piece {
  id: string
  x: number
  y: number
  z?: number
  dx: number
  dy: number
  dz: number
  color: string
}

/** Furniture in drawing order (far to near). */
export const FURNITURE: Piece[] = [
  { id: 'rug', x: 1.1, y: 1.55, dx: 2.3, dy: 1.45, dz: 0.015, color: '#2F6F73' },
  { id: 'headboard', x: 0.45, y: 0, dx: 1.6, dy: 0.1, dz: 1.05, color: '#3F548F' },
  { id: 'bed', x: 0.45, y: 0.1, dx: 1.6, dy: 2.0, dz: 0.45, color: '#5F78B8' },
  { id: 'blanket', x: 0.45, y: 1.0, z: 0.45, dx: 1.6, dy: 1.1, dz: 0.06, color: '#E8C9A0' },
  { id: 'pillow', x: 0.62, y: 0.2, z: 0.45, dx: 1.26, dy: 0.36, dz: 0.11, color: '#EEF1F8' },
  { id: 'nightstand', x: 2.15, y: 0.05, dx: 0.45, dy: 0.4, dz: 0.5, color: '#8A5A36' },
  { id: 'desk', x: 3.05, y: 0, dx: 1.1, dy: 0.6, dz: 0.75, color: '#C9A27A' },
  { id: 'wardrobe', x: 0, y: 2.3, dx: 0.62, dy: 1.1, dz: 2.1, color: '#DAD4C8' },
]

/** Window on the back wall (y = 0), above the desk. */
export const WINDOW = { x0: 3.0, x1: 4.05, z0: 1.0, z1: 2.15 } as const

/** Where each price tag is pinned, in metres: wallpaper, laminate, furniture. */
export const TAG_ANCHORS: [number, number, number][] = [
  [1.6, 0, 2.05],
  [3.55, 2.75, 0],
  [1.25, 1.55, 0.51],
]

// ── timeline (seconds) ──────────────────────────────────────────────────────

export const END = 6.9

const clamp = (v: number) => Math.min(1, Math.max(0, v))
const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a))
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)

export interface Frame {
  /** 0..1 of the floor outline traced */
  outline: number
  /** opacity of the plan dimensions */
  dims: number
  /** 0..1 of the wall height */
  walls: number
  /** 0..1 of the wallpaper + laminate going on */
  finish: number
  furniture: { opacity: number; lift: number }[]
  tags: number[]
  /** 0..1 of the estimate counted up */
  total: number
}

export function frameAt(t: number): Frame {
  return {
    outline: easeInOut(seg(t, 0.15, 1.2)),
    dims: seg(t, 0.85, 1.25),
    walls: easeInOut(seg(t, 1.3, 2.3)),
    finish: easeOut(seg(t, 2.4, 3.2)),
    furniture: FURNITURE.map((_, i) => {
      const u = seg(t, 3.2 + i * 0.16, 3.62 + i * 0.16)
      return { opacity: clamp(u * 2.5), lift: u >= 1 ? 0 : (1 - easeOut(u)) * 0.9 }
    }),
    tags: TAG_ANCHORS.map((_, i) => easeOut(seg(t, 4.85 + i * 0.28, 5.2 + i * 0.28))),
    total: easeOut(seg(t, 5.7, END)),
  }
}

/** Mixes a hex colour towards black (negative) or white (positive). */
export function shade(hex: string, amount: number): string {
  const to = amount < 0 ? 0 : 255
  const a = Math.abs(amount)
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  return '#' + c.map((v) => Math.round(v + (to - v) * a).toString(16).padStart(2, '0')).join('')
}
