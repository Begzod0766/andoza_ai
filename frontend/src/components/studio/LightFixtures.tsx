/**
 * 3D bodies for the light fixtures, drawn from the catalog spec.
 *
 * Each fixture is built from primitives rather than a GLB so a new type costs
 * one catalog entry and (at most) one case here — and so the body always
 * matches the settings the user just moved.
 *
 * Emission vs illumination are deliberately separate. Every fixture always
 * shows a lit emissive face (that is what makes it read as "a lamp"), but only
 * a pooled subset carries a real light — see LightEmitters. A scene with
 * fifteen shadow-casting spot lights is a slideshow, and the fifteenth one
 * adds nothing a viewer can see.
 */
import * as THREE from 'three'
import type { PlacedLight } from '@/store/roomStore'
import { hangingDropM, lightType, kelvinToHex, type LightType } from '@/lib/lightCatalog'

/** Where a fixture's body sits, in room-centred world metres. */
export interface FixturePose {
  x: number
  y: number
  z: number
  /** Yaw about Y. */
  rot: number
  /** How far a hanging body hangs below the ceiling, metres (0 for anything else). */
  drop: number
}

/**
 * Resolve a placed light to a world pose. Wall fixtures are pushed onto their
 * wall and turned to face into the room; everything else hangs from the
 * ceiling or stands on the floor at its plan position.
 */
export function fixturePose(
  light: PlacedLight,
  t: LightType,
  roomW: number,
  roomD: number,
  roomH: number,
): FixturePose {
  const x = light.xMm / 1000 - roomW / 2
  const z = light.zMm / 1000 - roomD / 2
  const rot = light.rotation ?? 0

  if (t.mount === 'wall') {
    const h = light.wallHM ?? t.wallHM ?? 1.8
    const inset = t.sizeM.d / 2
    switch (light.wallId ?? 'A') {
      case 'A': return { x, y: h, z: -roomD / 2 + inset, rot: 0, drop: 0 }
      case 'C': return { x, y: h, z: roomD / 2 - inset, rot: Math.PI, drop: 0 }
      case 'B': return { x: roomW / 2 - inset, y: h, z, rot: -Math.PI / 2, drop: 0 }
      case 'D': return { x: -roomW / 2 + inset, y: h, z, rot: Math.PI / 2, drop: 0 }
      default:
        // A polygon room's wall (W1..Wn): the Chiroqlar plan already stores
        // the fixture's point inset from that wall, and the wall's inward
        // facing in `rotation` (see ChiroqPlanView), so the plan point is
        // the pose. Before this the fixture silently fell through to the
        // ceiling branch below.
        return { x, y: h, z, rot, drop: 0 }
    }
  }

  if (t.mount === 'floor') return { x, y: 0, z, rot, drop: 0 }

  // Ceiling, recessed and track fixtures all hang from the ceiling plane.
  const drop = hangingDropM(light, t, roomH)
  return { x, y: roomH - drop, z, rot, drop }
}

/** Emissive material for the lit face — colour follows the fixture's kelvin. */
function emitterMaterial(hex: string, on: boolean, strength = 1) {
  return (
    <meshStandardMaterial
      color={on ? hex : '#3A3A3A'}
      emissive={on ? hex : '#000000'}
      emissiveIntensity={on ? strength : 0}
      roughness={0.35}
      metalness={0}
      toneMapped={false}
    />
  )
}

const METAL = <meshStandardMaterial color="#BFBBB0" metalness={0.65} roughness={0.3} />
const DARK = <meshStandardMaterial color="#3C3F45" metalness={0.4} roughness={0.5} />

/**
 * One fixture body. Positioned by the caller so the drag handle and the light
 * emitter can share the same pose.
 */
/** `drop` is the pose's (see `fixturePose`): the cord is drawn as long as the body actually hangs. */
export function LightFixture({ light, on, drop }: { light: PlacedLight; on: boolean; drop?: number }) {
  const t = lightType(light.type)
  const hex = kelvinToHex(light.colorK ?? t.colorK)
  const lit = on && !light.off
  const { w, h } = { w: t.sizeM.w, h: t.sizeM.h }

  switch (t.id) {
    case 'pendant':
      return (
        <group>
          <Cord length={drop ?? light.dropM ?? t.dropM ?? 0} />
          <mesh position={[0, -h / 2, 0]}>
            <coneGeometry args={[w / 2, h, 24, 1, true]} />
            <meshStandardMaterial color="#2F3338" side={THREE.DoubleSide} roughness={0.5} metalness={0.3} />
          </mesh>
          <mesh position={[0, -h + 0.02, 0]}>
            <sphereGeometry args={[w * 0.18, 16, 12]} />
            {emitterMaterial(hex, lit, 2.2)}
          </mesh>
        </group>
      )

    case 'chandelier': {
      // One fixture, not six floating lamps: a central column (the hub) under the cord, an arm
      // from it out and down to each candle cup, and a ring tying the arms together. Everything
      // sits at or below the body's origin, so a hub shortened up to the ceiling in a low room
      // (hangingDropM) never pokes through it. The bulbs keep their old places — the emitters
      // (LightEmitters) and the catalogue size are unchanged.
      const parts = chandelierParts(w, h)
      return (
        <group>
          <Cord length={drop ?? light.dropM ?? t.dropM ?? 0} />
          <mesh name="chandelier-hub" position={[0, -parts.hubH / 2, 0]}>
            <cylinderGeometry args={[CHANDELIER_HUB_R * 0.8, CHANDELIER_HUB_R, parts.hubH, 16]} />
            {METAL}
          </mesh>
          <mesh position={[0, -parts.hubH - 0.025, 0]}>
            <sphereGeometry args={[0.03, 12, 8]} />
            {METAL}
          </mesh>
          <mesh position={[0, parts.ringY, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[parts.ringR, 0.007, 6, 36]} />
            {METAL}
          </mesh>
          {parts.arms.map((arm, i) => (
            <group key={i}>
              <mesh name="chandelier-arm" position={arm.mid} quaternion={arm.quaternion}>
                <cylinderGeometry args={[0.009, 0.009, arm.length, 8]} />
                {METAL}
              </mesh>
              <mesh position={arm.cup}>
                <cylinderGeometry args={[0.035, 0.02, 0.03, 12]} />
                {METAL}
              </mesh>
              <mesh position={arm.bulb}>
                <sphereGeometry args={[0.05, 14, 10]} />
                {emitterMaterial(hex, lit, 2)}
              </mesh>
            </group>
          ))}
        </group>
      )
    }

    case 'ceiling':
      // One body only: a trim disc flush with its top shared the plane and flickered seen from
      // above, and inside the body it was never visible from the room anyway.
      return (
        <group>
          <mesh position={[0, -h / 2, 0]}>
            <cylinderGeometry args={[w / 2, w / 2 * 0.92, h, 28]} />
            {emitterMaterial(hex, lit, 1.3)}
          </mesh>
        </group>
      )

    case 'downlight':
      return (
        <group>
          <mesh position={[0, -0.012, 0]}>
            <cylinderGeometry args={[w / 2, w / 2, 0.024, 20]} />
            {METAL}
          </mesh>
          <mesh position={[0, -0.026, 0]}>
            <circleGeometry args={[w / 2 * 0.78, 20]} />
            {emitterMaterial(hex, lit, 2.6)}
          </mesh>
        </group>
      )

    case 'led_panel':
      return (
        <group>
          <mesh position={[0, -h / 2, 0]}>
            <boxGeometry args={[t.sizeM.w, h, t.sizeM.d]} />
            {METAL}
          </mesh>
          <mesh position={[0, -h - 0.001, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <planeGeometry args={[t.sizeM.w * 0.94, t.sizeM.d * 0.94]} />
            {emitterMaterial(hex, lit, 1.8)}
          </mesh>
        </group>
      )

    case 'spotlight':
    case 'ies':
      return (
        <group>
          <mesh position={[0, -0.02, 0]}>
            <cylinderGeometry args={[w / 2 * 0.7, w / 2 * 0.7, 0.04, 16]} />
            {METAL}
          </mesh>
          {/* Head tilts on its mount, so the body shows where the beam points */}
          <group position={[0, -0.05, 0]} rotation={[light.tiltRad ?? 0, 0, 0]}>
            <mesh position={[0, -h / 2 + 0.02, 0]}>
              <cylinderGeometry args={[w / 2 * 0.62, w / 2, h * 0.8, 18]} />
              {DARK}
            </mesh>
            <mesh position={[0, -h + 0.03, 0]}>
              <circleGeometry args={[w / 2 * 0.55, 18]} />
              {emitterMaterial(hex, lit, 2.8)}
            </mesh>
          </group>
        </group>
      )

    case 'led_linear':
      return (
        <group rotation={[0, 0, 0]}>
          <mesh position={[0, -h / 2, 0]}>
            <boxGeometry args={[t.sizeM.w, h, t.sizeM.d]} />
            {DARK}
          </mesh>
          <mesh position={[0, -h - 0.001, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <planeGeometry args={[t.sizeM.w * 0.96, t.sizeM.d * 0.7]} />
            {emitterMaterial(hex, lit, 2.2)}
          </mesh>
        </group>
      )

    case 'track':
    case 'led_track': {
      const heads = 4
      const railW = t.sizeM.w
      return (
        <group>
          <mesh position={[0, -0.025, 0]}>
            <boxGeometry args={[railW, 0.05, t.sizeM.d]} />
            {DARK}
          </mesh>
          {Array.from({ length: heads }, (_, i) => {
            const x = -railW / 2 + (railW / (heads - 1)) * i
            return (
              <group key={i} position={[x, -0.06, 0]} rotation={[light.tiltRad ?? 0, 0, 0]}>
                {t.id === 'track' ? (
                  <mesh position={[0, -0.05, 0]}>
                    <cylinderGeometry args={[0.032, 0.042, 0.1, 16]} />
                    {DARK}
                  </mesh>
                ) : (
                  <mesh position={[0, -0.04, 0]}>
                    <boxGeometry args={[0.07, 0.08, 0.07]} />
                    {DARK}
                  </mesh>
                )}
                <mesh position={[0, -0.101, 0]}>
                  <circleGeometry args={[0.026, 14]} />
                  {emitterMaterial(hex, lit, 2.8)}
                </mesh>
              </group>
            )
          })}
        </group>
      )
    }

    case 'bra':
      return (
        <group>
          <mesh position={[0, 0, 0.01]}>
            <boxGeometry args={[w * 0.5, 0.14, 0.02]} />
            {METAL}
          </mesh>
          <mesh position={[0, h * 0.16, t.sizeM.d / 2]}>
            <cylinderGeometry args={[w / 2, w / 2 * 0.8, h * 0.6, 18, 1, true]} />
            <meshStandardMaterial color="#F2EAD9" side={THREE.DoubleSide} roughness={0.75} />
          </mesh>
          <mesh position={[0, h * 0.16, t.sizeM.d / 2]}>
            <sphereGeometry args={[0.035, 14, 10]} />
            {emitterMaterial(hex, lit, 2.2)}
          </mesh>
        </group>
      )

    case 'bath':
      return (
        <group>
          <mesh position={[0, 0, 0.02]}>
            <boxGeometry args={[t.sizeM.w, h, 0.04]} />
            {METAL}
          </mesh>
          <mesh position={[0, 0, 0.045]}>
            <planeGeometry args={[t.sizeM.w * 0.9, h * 0.6]} />
            {emitterMaterial(hex, lit, 2)}
          </mesh>
        </group>
      )

    case 'floor_lamp':
      return (
        <group>
          <mesh position={[0, 0.015, 0]}>
            <cylinderGeometry args={[w / 2 * 0.7, w / 2 * 0.75, 0.03, 24]} />
            {DARK}
          </mesh>
          <mesh position={[0, h / 2, 0]}>
            <cylinderGeometry args={[0.016, 0.016, h, 12]} />
            {METAL}
          </mesh>
          <mesh position={[0, h - 0.12, 0]}>
            <cylinderGeometry args={[w / 2 * 0.85, w / 2, 0.26, 24, 1, true]} />
            <meshStandardMaterial color="#F2EAD9" side={THREE.DoubleSide} roughness={0.8} />
          </mesh>
          <mesh position={[0, h - 0.16, 0]}>
            <sphereGeometry args={[0.05, 14, 10]} />
            {emitterMaterial(hex, lit, 2)}
          </mesh>
        </group>
      )
  }
}

/** Suspension cord for a hanging fixture. */
function Cord({ length }: { length: number }) {
  if (length <= 0.01) return null
  return (
    <mesh name="cord" position={[0, length / 2, 0]}>
      <cylinderGeometry args={[0.006, 0.006, length, 6]} />
      {DARK}
    </mesh>
  )
}

const CHANDELIER_ARMS = 6
const CHANDELIER_HUB_R = 0.05

/**
 * The chandelier's layout in its own frame (origin where the cord meets it, y up): bulbs on a
 * circle of radius w/2 at y = -h*0.55 (where the emitters are), each standing in a cup, and
 * a straight arm from inside the hub column out and down to that cup.
 */
export function chandelierParts(w: number, h: number) {
  const r = w / 2
  const bulbY = -h * 0.55
  const cupY = bulbY - 0.065
  const hubH = h * 0.55
  /** Where the arms leave the column: inside it, below its top. */
  const innerR = CHANDELIER_HUB_R * 0.6
  const innerY = -hubH * 0.4
  const up = new THREE.Vector3(0, 1, 0)
  const arms = Array.from({ length: CHANDELIER_ARMS }, (_, i) => {
    const a = (i / CHANDELIER_ARMS) * Math.PI * 2
    const cx = Math.cos(a), cz = Math.sin(a)
    const inner = new THREE.Vector3(cx * innerR, innerY, cz * innerR)
    const outer = new THREE.Vector3(cx * r, cupY, cz * r)
    const dir = outer.clone().sub(inner)
    const length = dir.length()
    return {
      mid: inner.clone().add(outer).multiplyScalar(0.5).toArray() as [number, number, number],
      quaternion: new THREE.Quaternion().setFromUnitVectors(up, dir.normalize()),
      length,
      cup: [cx * r, cupY, cz * r] as [number, number, number],
      bulb: [cx * r, bulbY, cz * r] as [number, number, number],
    }
  })
  // The ring crosses every arm at 55% of its run from the hub.
  const k = 0.55
  return { hubH, arms, ringR: innerR + (r - innerR) * k, ringY: innerY + (cupY - innerY) * k }
}
