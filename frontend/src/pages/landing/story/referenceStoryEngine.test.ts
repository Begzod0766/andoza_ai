import { afterEach, describe, expect, it, vi } from 'vitest'
import storyHtml from './referenceStory.html?raw'
import { initScrollStory, type StoryLabels } from './referenceStoryEngine'

const labels: StoryLabels = {
  m: 'MTR',
  m2: 'SQM',
  wallpapers: ['w0', 'w1', 'w2', 'w3', 'w4', 'w5'],
  plan: 'plan',
  view3d: '3d',
  lidar: 'lidar',
  gypsum: 'gypsum',
  start: 'start',
  center: 'center',
  area: 'AREA',
  wallpaperCaps: 'WALLPAPER',
  furnitureCaps: 'FURNITURE',
  addWindow: 'add window',
  addDoor: 'add door',
  wallpaper: 'wallpaper',
  laminate: 'laminate',
  skirting: 'skirting',
  rolls: (n) => `${n} rolls`,
  rollsDiamond: (n) => `${n} rolls diamond`,
  rollsPrice: (n, p) => `${n} rolls ${p}`,
  pieces: (n) => `${n} pcs`,
}

/** A 2D context that does nothing but remember every text it was asked to draw. */
function recordingContext(drawn: string[], at: { text: string; x: number; y: number }[]) {
  const ctx: Record<string | symbol, unknown> = {
    measureText: (t: string) => ({ width: t.length * 7 }),
    fillText: (t: string, x: number, y: number) => {
      drawn.push(t)
      at.push({ text: t, x, y })
    },
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    createPattern: () => ({}),
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
  }
  return new Proxy(ctx, {
    get: (target, key) => (key in target ? target[key] : () => {}),
    set: () => true,
  })
}

let cleanup = () => {}
afterEach(() => {
  cleanup()
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

/** Mounts the story and renders it at `progress` (0..1 of the scroll) on a canvas `size` px wide. */
function renderAt(progress: number, size = { width: 700, height: 700 }) {
  const drawn: string[] = []
  const at: { text: string; x: number; y: number }[] = []
  vi.stubGlobal('Path2D', class { moveTo() {} lineTo() {} closePath() {} rect() {} arc() {} })
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(recordingContext(drawn, at) as never)
  document.body.innerHTML = storyHtml
  const story = document.getElementById('story')!
  const stage = document.getElementById('stage')!
  const total = 1000
  Object.defineProperty(story, 'offsetHeight', { value: total + 800 })
  Object.defineProperty(stage, 'offsetHeight', { value: 800 })
  vi.spyOn(story, 'getBoundingClientRect').mockReturnValue({ top: -progress * total } as DOMRect)
  vi.spyOn(document.getElementById('cv')!, 'getBoundingClientRect').mockReturnValue(size as DOMRect)
  cleanup = initScrollStory(labels)
  return Object.assign(drawn, { at })
}

describe('scroll story engine', () => {
  it('writes the wall lengths of the hand-drawn plan in metres', () => {
    // End of scene 2 (the plan): every wall has been drawn and labelled.
    const drawn = renderAt(0.225)
    const lengths = drawn.filter((t) => /^\d+\.\d\d /.test(t))
    expect(lengths.length).toBeGreaterThan(0)
    for (const t of lengths) expect(t).toMatch(/^\d+\.\d\d MTR$/)
    expect(drawn.join('|')).not.toContain('undefined')
  })

  it.each([
    ['plan', 0.225],
    ['3D', 0.31],
  ])('keeps every wall length inside a phone-sized canvas (%s scene)', (_, progress) => {
    // The story's canvas on a 375 px phone.
    const width = 343
    const { at } = renderAt(progress, { width, height: 330 })
    const lengths = at.filter((d) => / MTR$/.test(d.text))
    expect(lengths.length).toBeGreaterThan(0)
    for (const { text, x } of lengths) {
      const half = (text.length * 7 + 20) / 2 // the pill around the text
      expect(x - half, text).toBeGreaterThanOrEqual(0)
      expect(x + half, text).toBeLessThanOrEqual(width)
    }
  })

  it.each([
    ['plan, phone', 0.225, 343, 330],
    ['plan, desktop', 0.225, 700, 700],
  ])('never lets two wall lengths of the plan cover each other (%s)', (_, progress, width, height) => {
    const { at } = renderAt(progress, { width, height })
    const pills = at
      .filter((d) => / MTR$/.test(d.text))
      .map(({ text, x, y }) => ({ text, x, y, w: text.length * 7 + 20, h: 24 }))
    expect(pills.length).toBeGreaterThan(1)
    for (let i = 0; i < pills.length; i++)
      for (let j = i + 1; j < pills.length; j++) {
        const a = pills[i]
        const b = pills[j]
        const overlap = Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.y - b.y) < (a.h + b.h) / 2
        expect(overlap, `${a.text} / ${b.text}`).toBe(false)
      }
  })
})
