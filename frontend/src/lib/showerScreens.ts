import type { CatalogFurniture } from '@/lib/api'
import type { PlacedFurniture, RoomGeometry } from '@/store/types'
import { inferRole } from '@/lib/furnitureRole'
import { showerZoneSize } from '@/lib/floorDrain'
import { wallWalk } from '@/lib/plumbingRuns'

/**
 * A bath's and a tray-less shower's screen (2026-11-18): a glass panel or a curtain on a rod, the
 * user's pick in the Santexnika panel (`designState.bathScreen` / `showerScreen`), drawn in 3D and
 * priced by the estimate (backend smeta.py _screen_lines). A shower cabin or a shower panel has its own glass.
 */
export type ScreenKind = 'glass' | 'curtain'
export const screenChoice = (v: unknown): ScreenKind | null => (v === 'glass' || v === 'curtain' ? v : null)

/** A shower sold with its own glass, as the estimate reads one (backend smeta.py _OWN_GLASS): a cabin, a
 * shower panel, or a walk-in set named "(shishali)" (2026-11-18). */
export const hasOwnGlass = (name: string): boolean => /kabin|кабин|cabin|panel|панел|shishali|стекл|glass/i.test(name)
/** A bath sold with its own glass screen (2026-11-18: the catalog's, named "(shishali)"). Narrower than a
 * shower's: a "vanna paneli" is a bath's front panel, not glass (backend smeta.py _BATH_OWN_GLASS). */
export const bathHasOwnGlass = (name: string): boolean => /shishali|стекл|glass/i.test(name)

/** A bath or shower on the floor, metres: centre, width along its own x, depth along its z, turned about +Y. */
export interface WetRect { id: string; x: number; z: number; w: number; d: number; rotation: number }
/** A flat upright piece: its centre in plan, turned so its length runs along its local x; from `bottomM` up. */
export interface Panel { x: number; z: number; rotY: number; lengthM: number; bottomM: number; heightM: number }

const BATH = { glassM: 0.8, rimM: 0.58, glassHM: 1.4, curtainBottomM: 0.4, insetM: 0.03 }
const SHOWER = { glassM: 1.0, glassHM: 2.0, curtainBottomM: 0.05, insetM: 0 }
const ROD_M = 1.98
const ROD_H_M = 0.02
const CURTAIN_TOP_M = 1.95
/** The share of the front a drawn-back curtain takes. */
const CURTAIN_SHARE = 0.35
/** A piece this near a wall stands against it, metres. */
const AGAINST_M = 0.15
/** A usual bath when its catalog row gives no size, metres (backend smeta.py _WET_FOOTPRINT_CM). */
const BATH_W = 1.7, BATH_D = 0.7

const axes = (r: WetRect) => ({ fx: Math.sin(r.rotation), fz: Math.cos(r.rotation), sx: Math.cos(r.rotation), sz: -Math.sin(r.rotation) })

/** The end (+1 along its own x, or −1) of the piece standing against a side wall; +1 when neither does. */
export function wallEnd(r: WetRect, geometry: RoomGeometry): 1 | -1 {
  const { fx, fz, sx, sz } = axes(r)
  for (const s of [1, -1] as const) {
    const ends = [1, -1].map((a) => [r.x + fx * (r.d / 2) * a + sx * (r.w / 2) * s, r.z + fz * (r.d / 2) * a + sz * (r.w / 2) * s])
    const against = wallWalk(geometry).some((w) => Math.abs(w.nx * sx + w.nz * sz) > Math.SQRT1_2
      && ends.every(([x, z]) => Math.abs((x - w.startX) * w.nx + (z - w.startZ) * w.nz) <= AGAINST_M))
    if (against) return s
  }
  return 1
}

/** A panel `lengthM` long along the piece's front, from its wall end; `inset` metres in from the front edge. */
function frontPanel(r: WetRect, geometry: RoomGeometry, lengthM: number, inset: number, bottomM: number, heightM: number, fromEnd = true): Panel {
  const { fx, fz, sx, sz } = axes(r)
  const s = wallEnd(r, geometry)
  const shift = fromEnd ? s * (r.w / 2 - lengthM / 2) : 0
  const out = r.d / 2 - inset
  return { x: r.x + fx * out + sx * shift, z: r.z + fz * out + sz * shift, rotY: r.rotation, lengthM, bottomM, heightM }
}

/** The glass: a bath's 80 cm hinged panel on its rim at the wall end; a shower's along its front, at most 1 m. */
export function glassPanel(r: WetRect, geometry: RoomGeometry, kind: 'bath' | 'shower'): Panel {
  return kind === 'bath'
    ? frontPanel(r, geometry, BATH.glassM, BATH.insetM, BATH.rimM, BATH.glassHM)
    : frontPanel(r, geometry, Math.min(r.w, SHOWER.glassM), SHOWER.insetM, 0, SHOWER.glassHM)
}

/** The curtain: a rod the piece's width over its front, the curtain drawn back to the wall end. */
export function curtainParts(r: WetRect, geometry: RoomGeometry, kind: 'bath' | 'shower'): { rod: Panel; cloth: Panel } {
  const k = kind === 'bath' ? BATH : SHOWER
  return {
    rod: frontPanel(r, geometry, r.w, k.insetM, ROD_M, ROD_H_M, false),
    cloth: frontPanel(r, geometry, r.w * CURTAIN_SHARE, k.insetM, k.curtainBottomM, CURTAIN_TOP_M - k.curtainBottomM),
  }
}

function placedRects(furniture: PlacedFurniture[], catalog: CatalogFurniture[], role: 'bathtub' | 'shower'): WetRect[] {
  const byId = new Map(catalog.map((c) => [c.id, c]))
  return furniture.flatMap((f) => {
    const row = byId.get(f.furniture_id)
    const name = row?.name_uz ?? f.name ?? f.furniture_id
    if (inferRole(row?.category ?? null, name) !== role) return []
    if (role === 'bathtub' && bathHasOwnGlass(name)) return []
    if (role === 'shower') {
      if (hasOwnGlass(name)) return []
      const { w, d } = showerZoneSize(row?.footprint_w, row?.footprint_d, f.scaleOverride)
      return [{ id: f.id, x: f.x / 1000, z: f.y / 1000, w, d, rotation: f.rotation }]
    }
    const k = f.scaleOverride ?? 1
    const w = (row?.footprint_w ? row.footprint_w / 100 : BATH_W) * k
    const d = (row?.footprint_d ? row.footprint_d / 100 : BATH_D) * k
    return [{ id: f.id, x: f.x / 1000, z: f.y / 1000, w, d, rotation: f.rotation }]
  })
}

/** Each bath placed. */
export const screenedBaths = (furniture: PlacedFurniture[], catalog: CatalogFurniture[]) => placedRects(furniture, catalog, 'bathtub')
/** Each shower placed that is not a cabin or a panel (a tray, or a floor zone with a drain). */
export const screenedShowers = (furniture: PlacedFurniture[], catalog: CatalogFurniture[]) => placedRects(furniture, catalog, 'shower')
