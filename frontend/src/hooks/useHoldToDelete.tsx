import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { create } from 'zustand'
import { useTranslation } from 'react-i18next'
import { createHoldTracker, HOLD_DELETE_MS } from '@/lib/holdToDelete'

/**
 * Press and hold a placed thing for a second and a delete button appears where the
 * finger is: doors and windows, models, the skirting and cornice, the
 * electrical faceplates.
 *
 * State lives in a store rather than React context because most of these live
 * INSIDE the R3F `<Canvas>`, and context does not cross that boundary — a
 * provider outside it is invisible to the meshes, which is exactly where the
 * presses happen.
 *
 * One tracker for the whole app, since only one thing can be held at a time:
 * pressing a second item cancels the first cleanly instead of leaving a stray
 * timer to fire over the top of it.
 */
export interface HoldDeleteItem {
  /** Named above the button, so it is clear what is about to go. */
  label: string
  onDelete: () => void
  /** Offered beside delete when the item can be moved: a held door gets
   *  "Ko'chirish", which arms it so the next drag walks it along the wall. */
  onMove?: () => void
}

interface HoldDeleteState {
  pending: { x: number; y: number; item: HoldDeleteItem } | null
  open(p: { x: number; y: number; item: HoldDeleteItem }): void
  close(): void
}

const useHoldDeleteStore = create<HoldDeleteState>((set) => ({
  pending: null,
  open: (p) => set({ pending: p }),
  close: () => set({ pending: null }),
}))

/** True from the moment a hold fires until that press ends, so the release
 *  does not also read as a tap on the thing underneath. */
let heldThisPress = false

const tracker = createHoldTracker<HoldDeleteItem>({
  holdMs: HOLD_DELETE_MS,
  onHold: ({ x, y, payload }) => useHoldDeleteStore.getState().open({ x, y, item: payload }),
})

if (typeof window !== 'undefined') {
  // Movement and release are both watched on the window rather than per item.
  // Once a drag starts, the moves go to the canvas and the item never sees
  // another one — so a per-item listener would keep the hold alive through a
  // drag and delete what the user was moving. And a press can end anywhere,
  // including off the window, which has to stop the timer too.
  //
  // The release is heard in the capture phase: an overlay that stops its
  // pointerup (the ring's backdrop, the corner menu's scrim) otherwise hid it,
  // the timer ran on, and a second later this button's full-screen backdrop
  // came up under nobody's finger and ate the next tap (QA re-check R8).
  window.addEventListener('pointermove', (e) => tracker.move(e.clientX, e.clientY, e.pointerId))
  const end = () => { heldThisPress = tracker.up() }
  window.addEventListener('pointerup', end, true)
  window.addEventListener('pointercancel', end, true)
}

/** Puts the hold menu and any hold in progress away. The state is module-level,
 *  so tests call this between cases: a menu one test left open would otherwise
 *  still be up in the next one. */
export function resetHoldToDelete() {
  tracker.cancel()
  heldThisPress = false
  useHoldDeleteStore.getState().close()
}

/**
 * Handlers to spread onto a mesh. They do NOT stop propagation: the press
 * still has to reach whatever drag or selection the item already has, and the
 * hold gives way the moment that turns into a drag.
 */
export function useHoldToDelete() {
  const bind = useCallback((item: HoldDeleteItem) => ({
    onPointerDown: (e: { clientX: number; clientY: number; pointerId?: number }) =>
      tracker.down(e.clientX, e.clientY, item, e.pointerId),
  }), [])
  /** Whether the press that just ended fired a hold — checked before treating
   *  a release as a tap. */
  const wasHeld = useCallback(() => heldThisPress, [])
  /** Calls off a hold in progress: the press turned into something else (a pinch). */
  const cancel = useCallback(() => tracker.cancel(), [])
  return useMemo(() => ({ bind, wasHeld, cancel }), [bind, wasHeld, cancel])
}

/** The gap between the finger and the menu when it goes under the finger, px. */
const BELOW_GAP_PX = 28

interface Box { left: number; top: number; right: number; bottom: number }

/**
 * Which side of the finger the hold menu goes: over it (where a thumb does not hide it) unless,
 * there, it would cover something on screen that must stay readable, and under it would not.
 *
 * The case is a held MODEL: once selected it shows its own card (name, size, price) floating just
 * above it, and a finger holding the model's top put the menu's name pill straight over the card's
 * title (QA re-check R14). `avoid` are the boxes of such things (`data-hold-avoid`); `size` is the
 * menu's own. Under the finger is only taken when the menu fits on the screen there.
 */
export function holdMenuSide(
  finger: { x: number; y: number }, size: { w: number; h: number }, avoid: readonly Box[], viewportH: number,
): 'above' | 'below' {
  const at = (top: number): Box => ({ left: finger.x - size.w / 2, right: finger.x + size.w / 2, top, bottom: top + size.h })
  // Over the finger: translate(-50%, -120%) puts the menu's bottom a fifth of its height above it.
  const above = at(finger.y - 1.2 * size.h)
  const below = at(finger.y + BELOW_GAP_PX)
  const covered = (b: Box) => avoid.reduce((sum, a) =>
    sum + Math.max(0, Math.min(b.right, a.right) - Math.max(b.left, a.left)) * Math.max(0, Math.min(b.bottom, a.bottom) - Math.max(b.top, a.top)), 0)
  const overAbove = covered(above)
  if (overAbove === 0 || below.bottom > viewportH) return 'above'
  return covered(below) < overAbove ? 'below' : 'above'
}

/**
 * The button itself, at the point that was held. Mounted once, outside the
 * canvas — it is ordinary DOM, not part of the scene.
 */
export function HoldDeleteButton() {
  const { t } = useTranslation()
  const pending = useHoldDeleteStore((s) => s.pending)
  const close = useHoldDeleteStore((s) => s.close)
  const menuRef = useRef<HTMLDivElement>(null)
  const [side, setSide] = useState<'above' | 'below'>('above')

  useEffect(() => {
    if (!pending) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pending, close])

  // Keep it on screen when something near an edge is held.
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1080
  const vh = typeof window !== 'undefined' ? window.innerHeight : 1920
  const x = pending ? Math.max(80, Math.min(vw - 80, pending.x)) : 0
  const y = pending ? Math.max(64, Math.min(vh - 16, pending.y)) : 0

  // Measured before the first paint, so the menu never shows over the card and then jumps.
  useLayoutEffect(() => {
    const menu = menuRef.current
    if (!pending || !menu) { setSide('above'); return }
    const r = menu.getBoundingClientRect()
    const avoid = Array.from(document.querySelectorAll('[data-hold-avoid]'), (el) => el.getBoundingClientRect())
    setSide(holdMenuSide({ x, y }, { w: r.width, h: r.height }, avoid, vh))
  }, [pending, x, y, vh])

  if (!pending) return null

  return (
    <div
      className="fixed inset-0 z-[320]"
      // Anywhere else dismisses: while this is up, a stray tap should put it
      // away rather than hit whatever is behind it.
      //
      // Closed on pointerUP, not down: closing on the press unmounts this
      // backdrop before the browser dispatches the click, which then hit-tests
      // against the canvas now underneath and opens a surface ring — so
      // dismissing the delete button put a menu up in its place.
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => { e.stopPropagation(); close() }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        ref={menuRef}
        data-hold-menu={side}
        className="absolute flex flex-col items-center gap-1"
        style={{ left: x, top: y, transform: side === 'above' ? 'translate(-50%, -120%)' : `translate(-50%, ${BELOW_GAP_PX}px)` }}
        // BOTH halves of the press have to stop here, and forgetting the
        // second one is what broke deleting: the release on the delete button
        // bubbled to the backdrop above, which closed on pointerUp and
        // unmounted this whole tree — so the `click` that does the deleting
        // was never dispatched. The button looked alive, pressed, and did
        // nothing at all.
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
      >
        <span className="px-2 py-0.5 rounded-full bg-black/70 text-white text-[10px] font-semibold max-w-[170px] truncate">
          {pending.item.label}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); pending.item.onDelete(); close() }}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white text-[#E5484D] text-[13px] font-bold shadow-lg ring-1 ring-black/10 active:scale-95"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
          </svg>
          {t('common.ochirish')}
        </button>
        {pending.item.onMove && (
          <button
            onClick={(e) => { e.stopPropagation(); pending.item.onMove?.(); close() }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white text-[#2E5BFF] text-[13px] font-bold shadow-lg ring-1 ring-black/10 active:scale-95"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M5 12l4-4M5 12l4 4M19 12l-4-4M19 12l-4 4" />
            </svg>
            {t('common.kochirish')}
          </button>
        )}
      </div>
    </div>
  )
}
