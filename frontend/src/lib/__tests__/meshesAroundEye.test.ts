import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { meshesAroundEye } from '../panorama360'

/** A pendant like LightFixtures' cone: an open, double-sided shade hanging at the room's centre. */
function pendantRoom(shadeY: number) {
  const scene = new THREE.Scene()
  const floor = new THREE.Mesh(new THREE.BoxGeometry(5, 0.02, 3))
  floor.position.set(0, -0.01, 0)
  const fixture = new THREE.Group()
  fixture.position.set(0, shadeY, 0)
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.4, 24, 1, true))
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.6, 6))
  cord.position.set(0, 0.5, 0)
  fixture.add(shade, cord)
  const sofa = new THREE.Mesh(new THREE.BoxGeometry(2, 0.8, 0.9))
  sofa.position.set(1.5, 0.4, 1)
  scene.add(floor, fixture, sofa)
  scene.updateMatrixWorld(true)
  return { scene, shade, cord, floor, sofa }
}

describe('what the 360 camera stands inside (QA 2026-11-05 #2, the dark floor)', () => {
  it('finds a pendant shade hanging round the eye, and nothing else', () => {
    const { scene, shade } = pendantRoom(1.4)
    expect(meshesAroundEye(scene, new THREE.Vector3(0, 1.35, 0))).toEqual([shade])
  })

  it('finds nothing when the shade hangs clear above the eye', () => {
    const { scene } = pendantRoom(2.0)
    expect(meshesAroundEye(scene, new THREE.Vector3(0, 1.35, 0))).toEqual([])
  })

  it('never takes the room itself, which surrounds the eye by design', () => {
    const { scene, floor } = pendantRoom(1.4)
    const walls = new THREE.Mesh(new THREE.BoxGeometry(5, 2.4, 3))
    walls.position.set(0, 1.2, 0)
    scene.add(walls)
    scene.updateMatrixWorld(true)
    const found = meshesAroundEye(scene, new THREE.Vector3(0, 1.35, 0))
    expect(found).not.toContain(walls)
    expect(found).not.toContain(floor)
  })

  it('skips meshes already hidden', () => {
    const { scene, shade } = pendantRoom(1.4)
    shade.visible = false
    expect(meshesAroundEye(scene, new THREE.Vector3(0, 1.35, 0))).toEqual([])
  })
})
