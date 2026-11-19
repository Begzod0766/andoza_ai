import * as THREE from 'three'

/**
 * The 360 camera: where it stands, and how its picture is made.
 *
 * It stands in the middle of the room at eye height and has no target — it
 * turns on the spot rather than orbiting a point, because a panorama is taken
 * from somewhere, not of something.
 *
 * The picture is equirectangular, 4000 x 2000: the 2:1 ratio every 360 viewer
 * expects, since the image wraps 360 degrees across and 180 up and down.
 */

/**
 * Eye height, metres.
 *
 * 1650 mm at first — a standing person's eyes. Lowered 300 mm on the user's
 * ask (2026-10-07), which is roughly where an interior photographer puts a
 * tripod: a touch below eye level, so the picture looks across the room rather
 * than down into it, and the floor keeps its share of the frame.
 *
 * Shared with the fixed render cameras (`lib/roomCameras.ts`), so every
 * picture of a room is taken from the same height and the set hangs together.
 */
export const PANO_EYE_HEIGHT = 1.35

/** The horizontal angle the 360 camera keeps while being looked around with, degrees: the
 *  same 65 degrees the four station cameras frame with (`RENDER_HFOV_DEG` in roomCameras). */
export const PANO_LOOK_HFOV = 65
/** The widest vertical angle it goes to on a tall screen, before the room bends like a fish tank. */
export const PANO_LOOK_MAX_VFOV = 90

/**
 * three's vertical `fov` for the 360 camera while it is looked around with, for a canvas of this
 * aspect. The canvas camera's own fov (`base`) is vertical, so on a portrait phone it left only
 * about 24 degrees across: from the middle of a 3 m room the user saw one wall and nothing else,
 * and read it as a camera stood against the wall (QA 2026-11-05 #2). This keeps the width at
 * `PANO_LOOK_HFOV` up to `PANO_LOOK_MAX_VFOV`, and never narrows a wide screen below `base`.
 * Only the live view: the captured panorama is a full sphere and has no fov.
 */
export function panoramaLookFov(aspect: number, base: number): number {
  if (!(aspect > 0)) return base
  const h = (PANO_LOOK_HFOV * Math.PI) / 180
  const v = (2 * Math.atan(Math.tan(h / 2) / aspect) * 180) / Math.PI
  return Math.max(base, Math.min(PANO_LOOK_MAX_VFOV, v))
}

/** Width assumed for a canvas that has not been measured yet: a phone's. */
const UNMEASURED_WIDTH_PX = 393
/** Narrower than this and a swipe would spin the view; nothing real is this narrow. */
const MIN_LOOK_WIDTH_PX = 200

/**
 * How far a drag turns the 360 view, radians per CSS pixel, for a canvas this wide.
 *
 * A full-width swipe turns it half way round, so looking behind you is two swipes on any
 * screen. It used to be a fixed 0.0042 rad/px, which on a 390 px phone was about 90 degrees
 * a swipe and four swipes to look round (QA 2026-11-05 #18), while on a desktop it was more
 * than a full turn across the window.
 */
export function panoramaLookSpeed(widthPx: number): number {
  const w = Number.isFinite(widthPx) && widthPx > 0 ? Math.max(MIN_LOOK_WIDTH_PX, widthPx) : UNMEASURED_WIDTH_PX
  return Math.PI / w
}

export const PANO_WIDTH = 4000
export const PANO_HEIGHT = 2000

/** Each face of the cube the panorama is stitched from. 1024 keeps the four
 *  walls crisp at 4000 across without asking for a texture a phone may not
 *  grant. */
const FACE_SIZE = 1024

/**
 * Cube face to equirectangular.
 *
 * For each pixel of the output, the UV becomes a longitude and a latitude,
 * that pair becomes a direction on the unit sphere, and the direction samples
 * the cube. Longitude runs from -PI to PI across the image, latitude from
 * +PI/2 at the top to -PI/2 at the bottom, which is the convention every 360
 * viewer assumes.
 *
 * The centre of the image looks toward +z and the image runs LEFT TO RIGHT as
 * the viewer turns to their right. Facing +z, a person's right hand is -x, so x
 * is negated: without the minus the whole room comes out mirrored (a door on
 * the left of the window in the room appeared on its right in the picture).
 */
export const EQUIRECT_FRAGMENT = /* glsl */`
  uniform samplerCube cube;
  uniform float yaw;
  varying vec2 vUv;
  #define PI 3.141592653589793
  void main() {
    float lon = (vUv.x - 0.5) * 2.0 * PI + yaw;
    float lat = (vUv.y - 0.5) * PI;
    vec3 dir = vec3(
      -cos(lat) * sin(lon),
      sin(lat),
      cos(lat) * cos(lon)
    );
    gl_FragColor = textureCube(cube, dir);
  }
`

const EQUIRECT_VERTEX = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

/**
 * The largest equirectangular image this GPU will render, at 2:1.
 *
 * 4000 x 2000 is what we ask for; a device whose maximum texture is 2048 — and
 * some phones' is — would fail the allocation outright, so it takes what it
 * can get instead of nothing.
 */
export function panoramaSizeFor(maxTexture: number): { width: number; height: number } {
  const width = Math.min(PANO_WIDTH, Math.max(1024, maxTexture))
  return { width, height: width / 2 }
}

/**
 * Renders the scene as an equirectangular panorama from `position`.
 *
 * Returns the pixels bottom-up, as WebGL hands them over — the caller flips
 * them into an image.
 */
export function renderPanorama(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  position: THREE.Vector3,
  size: { width: number; height: number },
  /** The turn of the picture, radians (`panoramaSeamYaw`): 0 has its middle toward +z, its seam toward -z. */
  yaw = 0,
): { pixels: Uint8Array; width: number; height: number } {
  const cubeTarget = new THREE.WebGLCubeRenderTarget(FACE_SIZE, {
    generateMipmaps: false,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    colorSpace: THREE.SRGBColorSpace,
  })
  const cubeCamera = new THREE.CubeCamera(0.05, 100, cubeTarget)
  cubeCamera.position.copy(position)

  const target = new THREE.WebGLRenderTarget(size.width, size.height, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    colorSpace: THREE.SRGBColorSpace,
  })

  const quadScene = new THREE.Scene()
  const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  const material = new THREE.ShaderMaterial({
    uniforms: { cube: { value: cubeTarget.texture }, yaw: { value: yaw } },
    vertexShader: EQUIRECT_VERTEX,
    fragmentShader: EQUIRECT_FRAGMENT,
    depthTest: false,
    depthWrite: false,
  })
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)
  quadScene.add(quad)

  const previousTarget = renderer.getRenderTarget()
  try {
    cubeCamera.update(renderer, scene)
    renderer.setRenderTarget(target)
    renderer.render(quadScene, quadCamera)

    const pixels = new Uint8Array(size.width * size.height * 4)
    renderer.readRenderTargetPixels(target, 0, 0, size.width, size.height, pixels)
    return { pixels, width: size.width, height: size.height }
  } finally {
    renderer.setRenderTarget(previousTarget)
    quad.geometry.dispose()
    material.dispose()
    target.dispose()
    cubeTarget.dispose()
  }
}

/**
 * WebGL reads a framebuffer from the bottom row up; an image goes top row
 * down. Flipping is the whole difference between a panorama and an upside-down
 * one — floor in the sky.
 *
 * Returns the rows, not an ImageData: the pixels are the part worth checking,
 * and ImageData is a browser type the tests have no business needing.
 */
export function flipRows(
  pixels: Uint8Array,
  width: number,
  height: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(pixels.length)
  const rowBytes = width * 4
  for (let y = 0; y < height; y++) {
    const from = y * rowBytes
    const to = (height - 1 - y) * rowBytes
    out.set(pixels.subarray(from, from + rowBytes), to)
  }
  return out
}

/**
 * The room as a finished equirectangular canvas, from its middle at eye height.
 *
 * The same picture the 360 camera's own button writes out, for callers that
 * want it without being in the 360 camera: the render sheet sends it for
 * rendering. Where the studio's camera is does not matter — a panorama is
 * taken from the middle of the room whatever the user is looking at.
 *
 * @param eye the middle of the room in world metres, from `roomCentreWorld`
 *        (lib/roomCentre.ts). Omitting it falls back to the origin, which is
 *        the middle only of a rectangular room; every caller inside the studio
 *        passes the real centre, because in a drawn L-shaped room the origin is
 *        the outline's vertex mean and lands in the cut-away notch — a
 *        panorama of the inside of a wall.
 */
export function capturePanoramaCanvas(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  eye: { x: number; z: number } = { x: 0, z: 0 },
  /** The picture's turn (`panoramaSeamYaw`), so its seam is not on the furniture. */
  yaw = 0,
): HTMLCanvasElement {
  const size = panoramaSizeFor(renderer.capabilities.maxTextureSize)
  const { pixels, width, height } = renderPanorama(renderer, scene, new THREE.Vector3(eye.x, PANO_EYE_HEIGHT, eye.z), size, yaw)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const image = ctx.createImageData(width, height)
    image.data.set(flipRows(pixels, width, height))
    ctx.putImageData(image, 0, 0)
  }
  return canvas
}

/**
 * One ordinary perspective picture of the scene, from a fixed camera.
 *
 * The same read-and-flip as the panorama above, with a plain camera instead of
 * a cube: render into an offscreen target at the picture's own resolution so
 * the shot is never limited by the size of the viewport the user happens to
 * have, then read the pixels back and turn them the right way up.
 *
 * Deliberately NOT `renderer.render` to the screen followed by reading the
 * canvas: the canvas is the user's viewport, with its own aspect, its own
 * device pixel ratio and the UI composited over it on some browsers.
 */
export function captureViewCanvas(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  pose: {
    position: { x: number; y: number; z: number }
    target: { x: number; y: number; z: number }
  },
  size: { width: number; height: number },
  verticalFovDeg: number,
): HTMLCanvasElement {
  const camera = new THREE.PerspectiveCamera(
    verticalFovDeg,
    size.width / size.height,
    0.05,
    200,
  )
  camera.position.set(pose.position.x, pose.position.y, pose.position.z)
  camera.lookAt(pose.target.x, pose.target.y, pose.target.z)
  camera.updateProjectionMatrix()

  const target = new THREE.WebGLRenderTarget(size.width, size.height, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    colorSpace: THREE.SRGBColorSpace,
  })

  const previousTarget = renderer.getRenderTarget()
  const pixels = new Uint8Array(size.width * size.height * 4)
  try {
    renderer.setRenderTarget(target)
    renderer.render(scene, camera)
    renderer.readRenderTargetPixels(target, 0, 0, size.width, size.height, pixels)
  } finally {
    renderer.setRenderTarget(previousTarget)
    target.dispose()
  }

  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const image = ctx.createImageData(size.width, size.height)
    image.data.set(flipRows(pixels, size.width, size.height))
    ctx.putImageData(image, 0, 0)
  }
  return canvas
}

/** How close to the eye a mesh's box may come before it counts as wrapped round it, metres. */
const EYE_CLEARANCE = 0.05
/** Wider than this across the floor is the room itself (its walls, its ceiling), not a fixture. */
const MAX_WRAPPING_SPAN = 1.5

/**
 * The visible meshes whose box wraps round the 360 camera's eye: a pendant's shade hanging from
 * the middle of a low ceiling down to eye height. Standing inside it, every look down saw the
 * inside of the shade, read as a dark polygon on the floor (QA 2026-11-05 #2, found in
 * "Mening xonam": a 24-sided cone 0.11 m from the eye in every direction). The room's own shell
 * also surrounds the eye, so only pieces narrower than `MAX_WRAPPING_SPAN` are returned.
 */
export function meshesAroundEye(scene: THREE.Object3D, eye: THREE.Vector3): THREE.Mesh[] {
  scene.updateMatrixWorld(true)
  const found: THREE.Mesh[] = []
  const box = new THREE.Box3()
  const size = new THREE.Vector3()
  scene.traverseVisible((o) => {
    if (!(o instanceof THREE.Mesh)) return
    box.setFromObject(o)
    if (box.isEmpty()) return
    box.getSize(size)
    if (Math.max(size.x, size.z) > MAX_WRAPPING_SPAN) return
    if (box.expandByScalar(EYE_CLEARANCE).containsPoint(eye)) found.push(o)
  })
  return found
}

/** Half the width of the strip either side of the seam the render service blurs, radians (about 20 degrees). */
const SEAM_HALF = Math.PI / 9
/** The turns tried for the seam, 5 degrees apart. */
const SEAM_STEP = Math.PI / 36

/**
 * The turn for the panorama so its seam (its left and right edges, which the render service does not join
 * and blurs: kitchen re-check 2026-11-19, the seam on the kitchen set) faces the emptiest way from `eye`.
 * The cost of a turn is how much of the pieces' outline, seen from the eye, falls in the strip either side
 * of the seam. 0, the old turn, when nothing is there; else the least costly, the nearest to 0 on a tie.
 * Pieces in world metres, as the studio draws them; one the eye stands in is left out.
 */
export function panoramaSeamYaw(eye: { x: number; z: number }, pieces: readonly { x: number; z: number; w: number; d: number; rotation: number }[]): number {
  const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))
  // The way a point lies from the eye, as an angle a seam at that yaw faces: seam(yaw) = (sin yaw, -cos yaw).
  const spans = pieces.flatMap((r) => {
    const fx = Math.sin(r.rotation), fz = Math.cos(r.rotation), wx = Math.cos(r.rotation), wz = -Math.sin(r.rotation)
    const corners = [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([a, b]) => ({
      x: r.x + wx * (r.w / 2) * a + fx * (r.d / 2) * b, z: r.z + wz * (r.w / 2) * a + fz * (r.d / 2) * b,
    }))
    const angles = corners.map((c) => Math.atan2(c.x - eye.x, -(c.z - eye.z)))
    // Around the first corner, so a piece across the -PI/PI line is one span, not two.
    const rel = angles.map((a) => wrap(a - angles[0]))
    const lo = Math.min(...rel), hi = Math.max(...rel)
    return hi - lo >= Math.PI ? [] : [{ from: angles[0] + lo, to: angles[0] + hi }]
  })
  const cost = (yaw: number) => spans.reduce((sum, sp) => {
    const a = wrap(sp.from - yaw), b = a + (sp.to - sp.from)
    const part = (lo: number, hi: number) => Math.max(0, Math.min(hi, SEAM_HALF) - Math.max(lo, -SEAM_HALF))
    // A span past +PI comes round again from -PI.
    return sum + part(a, b) + part(a - 2 * Math.PI, b - 2 * Math.PI)
  }, 0)
  if (cost(0) <= 1e-9) return 0
  let best = 0, bestCost = cost(0)
  for (let k = 1; k < 72; k++) {
    for (const yaw of [k * SEAM_STEP, -k * SEAM_STEP]) {
      if (Math.abs(yaw) > Math.PI + 1e-9) continue
      const c = cost(yaw)
      if (c < bestCost - 1e-9) { best = yaw; bestCost = c }
    }
  }
  return best
}
