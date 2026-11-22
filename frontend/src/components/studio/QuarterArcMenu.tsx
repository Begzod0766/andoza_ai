/**
 * QuarterArcMenu — the categories sit as small buttons on a tight quarter arc
 * in the bottom-right corner. Pressing one blows the menu up along a larger
 * quarter circle, up and to the left, in two rings: the categories at full
 * size on the inner arc, and the pressed category's own items on an outer one
 * beyond them. There used to be an arrow button that had to be opened first;
 * the small categories are that button now, one tap closer to what they hold.
 *
 * The outer ring scrolls ALONG the arc. A library of 87 wallpapers will never
 * fit on a quarter circle, and a "more" button that dumped the user into a
 * panel was a dead end rather than a way through them — so the ring is dragged
 * round its own curve instead, like beads on a wire.
 *
 * Mobile's answer to a toolbar: the corner is the one spot a thumb reaches
 * without crossing the viewport, and the quarter arc is the slice of screen
 * that thumb sweeps through. Purely presentational — the caller supplies the
 * categories, their items and what picking one does.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ARC_ITEM, ARC_ITEM_OUTER, ARC_RADIUS, ARC_RADIUS_OUTER,
  angleAt, arcCapacity, arcOffsets, arcSlots, distanceFrom,
  maxArcOffset, ringAtDistance, slotsFromAngleDelta, wrapArcOffset,
} from '@/lib/arcMenu'

export interface ArcItem {
  key: string
  label: string
  /** Shown when there is no `imageUrl` — an emoji or an inline icon. */
  icon?: ReactNode
  /** A real thumbnail: a model's render, a wallpaper swatch. Fills the button. */
  imageUrl?: string
  /** A drawn thumbnail — a milled profile, a laying pattern — filling the
   *  button the way `imageUrl` does, for the pickers whose preview is the
   *  real geometry rather than a photo. */
  fill?: ReactNode
  /** A further ring this item opens in place of acting — the rooms under
   *  Mebel. Tapping the category again comes back out. */
  items?: ArcItem[]
  onSelect: () => void
  /** The pick hands over to a panel (it opens one): the menu closes, or it stays over the panel. */
  closesMenu?: boolean
}

export interface ArcCategory {
  key: string
  label: string
  icon: ReactNode
  /** The outer ring for this category. */
  items: ArcItem[]
  /** Shown in place of an empty outer ring, as a single button. */
  emptyItem?: ArcItem
  /** Names this category for the Studio tour: its button gets `data-tour="arc-<tourKey>"`
   *  and the open ring `arc-<tourKey>-ring-<depth>`. */
  tourKey?: string
}

/** Finger travel, in slot units, past which a drag stops counting as a tap. */
const DRAG_SLOP_SLOTS = 0.18

/**
 * The arc's centre is the middle of an invisible box this size; the caller's
 * `className` places the box. It no longer draws anything — the arrow it used
 * to be is gone — it only fixes where both arcs are measured from.
 */
const ANCHOR = 40
/** The closed menu: small categories hugging the corner. The radius is the
 *  least at which four of them clear each other, so the closed arc holds the
 *  same slots as the open one and a category stays put as it grows. */
const COMPACT_ITEM = 34
const COMPACT_RADIUS = 78

export function QuarterArcMenu({
  categories,
  label,
  className = '',
  onOpenChange,
  tourId,
  closed = false,
}: {
  categories: ArcCategory[]
  /** Accessible name for the group of corner buttons. */
  label?: string
  /** Positioning for the (invisible) anchor box the arcs are centred on. */
  className?: string
  /** Fires as the menu opens and closes, so the page can clear whatever the
   *  fanned-out ring would otherwise land on top of. */
  onOpenChange?: (open: boolean) => void
  /** The Studio tour's target id for the corner button (StudioTour). */
  tourId?: string
  /** While true the menu is folded away (the Studio tour runs over it). */
  closed?: boolean
}) {
  const { t } = useTranslation()
  const buttonLabel = label ?? t('studio.arc.add')
  const [open, setOpen] = useState(false)
  const [activeKey, setActiveKey] = useState<string | null>(null)
  /** The path drilled into within the active category, deepest last: Pol
   *  leads to Kafel, Kafel to a size, a size to its faces. A single level was
   *  enough for the rooms under Mebel and is not enough for this. */
  const [trail, setTrail] = useState<ArcItem[]>([])
  // One scroll position per ring: six categories no more fit the inner arc
  // than 87 wallpapers fit the outer one, and they scroll independently.
  const [offset, setOffset] = useState({ inner: 0, outer: 0 })
  const fabRef = useRef<HTMLDivElement | null>(null)
  /** Live gesture: which ring it grabbed, where it started, and whether it has
   *  become a drag yet. */
  const drag = useRef<
    { ring: 'inner' | 'outer'; startAngle: number; startOffset: number; moved: boolean } | null
  >(null)
  /** Whether the gesture that just ended was a scroll. Separate from `drag`,
   *  which is already cleared by the time the click lands: the click fires
   *  AFTER pointerup, so a guard reading the live gesture always saw null and
   *  let a scroll that happened to start on a button apply it as well. Cleared
   *  on the next press, so the tap after a scroll still counts. */
  const didDrag = useRef(false)

  // Escape backs out one level at a time — the items first, then the whole
  // menu — which is what a user reaching for it after a mis-tap expects.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (trail.length) setTrail((t) => t.slice(0, -1))
      else if (activeKey) setActiveKey(null)
      else setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, activeKey, trail])

  function closeAll() {
    setOpen(false)
    setActiveKey(null)
    setTrail([])
    setOffset({ inner: 0, outer: 0 })
  }

  useEffect(() => { if (closed) closeAll() }, [closed]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { onOpenChange?.(open) }, [open, onOpenChange])

  const active = categories.find((c) => c.key === activeKey) ?? null
  const shown = trail.length ? trail[trail.length - 1].items ?? [] : active?.items ?? []
  const outer: ArcItem[] = active
    ? (shown.length === 0 ? (active.emptyItem ? [active.emptyItem] : []) : shown)
    : []

  /**
   * How a ring is laid out. When everything fits it is spread across the whole
   * quarter so it sits balanced; once it doesn't, the slots keep a fixed pitch
   * — a spread-to-fit layout would slide every button around under the finger
   * as the list advanced — and the ring scrolls.
   */
  function ringLayout(count: number, radius: number, size: number, off: number, capacity = arcCapacity(radius, size)) {
    const scrollable = maxArcOffset(count, capacity) > 0
    return {
      capacity,
      scrollable,
      slots: scrollable ? arcSlots(count, capacity, off, radius) : null,
      even: scrollable ? null : arcOffsets(count, radius),
    }
  }

  // Closed, the categories ride the small arc — but with the open arc's slot
  // count, so each one is in the same place on both and simply grows outward.
  const innerRing = ringLayout(
    categories.length,
    open ? ARC_RADIUS : COMPACT_RADIUS,
    ARC_ITEM,
    offset.inner,
    arcCapacity(ARC_RADIUS, ARC_ITEM),
  )
  const catSize = open ? ARC_ITEM : COMPACT_ITEM
  const outerRing = ringLayout(outer.length, ARC_RADIUS_OUTER, ARC_ITEM_OUTER, offset.outer)
  const scrollable = innerRing.scrollable || outerRing.scrollable

  /** The arc's centre in client coordinates — the anchor box's centre. */
  function centre() {
    const r = fabRef.current?.getBoundingClientRect()
    if (!r) return null
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 }
  }

  /** The ring a gesture is steering, and how far it may be pushed. */
  function ringOf(which: 'inner' | 'outer') {
    return which === 'inner'
      ? { count: categories.length, capacity: innerRing.capacity }
      : { count: outer.length, capacity: outerRing.capacity }
  }

  function onDragStart(e: React.PointerEvent) {
    didDrag.current = false
    if (!scrollable) return
    const c = centre()
    if (!c) return
    // Commit to one ring now: they scroll independently, and a finger that
    // drifted between them mid-sweep would otherwise hand the gesture over
    // halfway through.
    const ring = open ? ringAtDistance(distanceFrom(c.cx, c.cy, e.clientX, e.clientY)) : 'inner'
    drag.current = {
      ring,
      startAngle: angleAt(c.cx, c.cy, e.clientX, e.clientY),
      startOffset: offset[ring],
      moved: false,
    }
  }

  function onDragMove(e: React.PointerEvent) {
    const d = drag.current
    const c = centre()
    if (!d || !c) return
    const { capacity } = ringOf(d.ring)
    const delta = slotsFromAngleDelta(angleAt(c.cx, c.cy, e.clientX, e.clientY) - d.startAngle, capacity)
    if (Math.abs(delta) > DRAG_SLOP_SLOTS) d.moved = true
    // Nothing is clamped: the ring is endless, so the sweep just keeps going
    // and the list comes back round.
    setOffset((o) => ({ ...o, [d.ring]: d.startOffset + delta }))
  }

  function onDragEnd() {
    const d = drag.current
    drag.current = null
    if (!d) return false
    didDrag.current = d.moved
    // Settle on a whole slot so the ring comes to rest with buttons on their
    // marks rather than halfway between two, then fold back into one lap so a
    // long run of sweeps can't grow the number without bound.
    const { count } = ringOf(d.ring)
    if (d.moved) setOffset((o) => ({ ...o, [d.ring]: wrapArcOffset(Math.round(o[d.ring]), count) }))
    return d.moved
  }

  /**
   * A pick only counts if the gesture that ended on it was not a scroll.
   *
   * Picking deliberately leaves the menu open. Adding things comes in runs —
   * three downlights, a few wallpapers to compare — and closing after each one
   * meant reopening and scrolling back to the same place every time. It closes
   * when the user says so: a tap on the backdrop, or Escape — which puts it
   * back down into the small corner arc.
   */
  function pick(item: ArcItem) {
    if (didDrag.current) return
    // An item that carries its own ring opens it instead of acting: the rooms
    // under Mebel, where the whole catalog in one arc was a long scroll.
    if (item.items?.length) {
      setOffset((o) => ({ ...o, outer: 0 }))
      setTrail((t) => [...t, item])
      return
    }
    item.onSelect()
    if (item.closesMenu) closeAll()
  }

  function renderOuterButton(item: ArcItem, pos: { dx: number; dy: number }, opacity: number, i: number, slotKey: number | string) {
    return (
      <button
        key={`${activeKey}:${trail.map((t) => t.key).join('/')}:${slotKey}`}
        onPointerDown={(e) => { e.stopPropagation(); onDragStart(e) }}
        onPointerMove={onDragMove}
        onPointerUp={() => onDragEnd()}
        onClick={(e) => { e.stopPropagation(); pick(item) }}
        title={item.label}
        className="pointer-events-auto absolute flex flex-col items-center justify-center gap-0.5 rounded-full bg-white text-brand shadow-lg ring-1 ring-black/5 overflow-hidden active:scale-95"
        style={{
          left: ANCHOR / 2 + pos.dx,
          top: ANCHOR / 2 + pos.dy,
          width: ARC_ITEM_OUTER,
          height: ARC_ITEM_OUTER,
          transform: 'translate(-50%, -50%)',
          opacity,
          // Only the first fan-out is animated: re-running it on every scroll
          // frame would fight the drag it is supposed to follow.
          animation: scrollable ? undefined : `arcpop 160ms ease-out ${i * 35}ms backwards`,
          touchAction: 'none',
        }}
      >
        {item.imageUrl || item.fill ? (
          <>
            {item.imageUrl
              ? <img src={item.imageUrl} alt="" loading="lazy" draggable={false} className="absolute inset-0 w-full h-full object-cover" />
              : <span className="absolute inset-0 flex items-center justify-center [&>svg]:w-full [&>svg]:h-full">{item.fill}</span>}
            {/* The label rides a scrim at the foot of the thumbnail — a name
                over a busy wallpaper is unreadable otherwise. */}
            <span className="absolute inset-x-0 bottom-0 px-0.5 py-[1px] bg-black/55 text-white text-[7px] font-semibold leading-tight truncate">
              {item.label}
            </span>
          </>
        ) : (
          <>
            <span className="text-base leading-none flex items-center justify-center">{item.icon}</span>
            <span className="text-[7px] font-semibold leading-none text-gray-600 px-0.5 truncate max-w-full">
              {item.label}
            </span>
          </>
        )}
      </button>
    )
  }

  return (
    <>
      {/* Scrim: carries the drag when it starts off a button (most of the arc
          is empty space), catches the tap that dismisses, and drops the 3D
          view back so the fanned buttons read as a layer above it. */}
      {open && (
        <div
          className="absolute inset-0 z-30 bg-black/25 animate-[arcfade_140ms_ease-out]"
          style={{ touchAction: 'none' }}
          onPointerDown={(e) => { e.stopPropagation(); onDragStart(e) }}
          onPointerMove={onDragMove}
          onPointerUp={(e) => {
            e.stopPropagation()
            // A drag that happened to start on the backdrop must not also
            // dismiss the menu when the finger lifts.
            if (!onDragEnd()) closeAll()
          }}
          aria-hidden="true"
        />
      )}

      <div
        ref={fabRef}
        role="group"
        aria-label={buttonLabel}
        className={`absolute z-30 pointer-events-none ${className}`}
        style={{ width: ANCHOR, height: ANCHOR }}
      >
        {/* What the studio tour spotlights: the small arc's footprint. The
            anchor box itself is an empty 40px square in the corner. */}
        {tourId && (
          <div
            data-tour={tourId}
            aria-hidden="true"
            className="absolute pointer-events-none"
            style={{
              right: 0,
              bottom: 0,
              width: ANCHOR / 2 + COMPACT_RADIUS + COMPACT_ITEM / 2,
              height: ANCHOR / 2 + COMPACT_RADIUS + COMPACT_ITEM / 2,
            }}
          />
        )}
        {/* The open outer ring's footprint, for the tour: the ring the finger is
            on is `ring-<depth>` (rooms 0, a room's models 1). */}
        {open && active?.tourKey && (
          <div
            data-tour={`arc-${active.tourKey}-ring-${trail.length}`}
            aria-hidden="true"
            className="absolute pointer-events-none"
            style={{
              right: 0,
              bottom: 0,
              width: ANCHOR / 2 + ARC_RADIUS_OUTER + ARC_ITEM_OUTER / 2,
              height: ANCHOR / 2 + ARC_RADIUS_OUTER + ARC_ITEM_OUTER / 2,
            }}
          />
        )}
        {/* Outer ring — the active category's own things. Rendered first so
            the category buttons paint over it where the rings crowd. */}
        {open && outerRing.slots
          ? outerRing.slots.map((s) => renderOuterButton(outer[s.index], s, s.opacity, s.index, s.key))
          : open && outerRing.even
            ? outer.map((item, i) => renderOuterButton(item, outerRing.even![i], 1, i, item.key))
            : null}

        {/* Inner ring — the categories, always there: small in the corner
            while closed, full size once open. Tapping one while open swaps the
            outer ring instead of closing, so they stay reachable from each
            other; tapping one while closed opens the menu straight onto it. */}
        {(innerRing.slots
          ? innerRing.slots.map((s) => ({ cat: categories[s.index], pos: s, i: s.index, opacity: s.opacity, slotKey: s.key as number | string }))
          : categories.map((cat, i) => ({ cat, pos: innerRing.even![i], i, opacity: 1, slotKey: cat.key as number | string }))
        ).map(({ cat, pos, i, opacity, slotKey }) => {
          const { dx, dy } = pos
          const isActive = cat.key === activeKey
          return (
            <button
              key={slotKey}
              onPointerDown={(e) => { e.stopPropagation(); onDragStart(e) }}
              onPointerMove={onDragMove}
              onPointerUp={() => onDragEnd()}
              onClick={(e) => {
                e.stopPropagation()
                if (didDrag.current) return
                // A different category starts its own ring at the beginning.
                setOffset((o) => ({ ...o, outer: 0 }))
                if (!open) {
                  setOpen(true)
                  setTrail([])
                  setActiveKey(cat.key)
                  return
                }
                // Tapping the live category backs out of a sub-ring first, so
                // the way back from a room's models is the button that opened
                // it — the same place the finger already is.
                if (cat.key === activeKey && trail.length) { setTrail((t) => t.slice(0, -1)); return }
                setTrail([])
                setActiveKey((k) => (k === cat.key ? null : cat.key))
              }}
              aria-pressed={isActive}
              data-tour={cat.tourKey ? `arc-${cat.tourKey}` : undefined}
              className={`pointer-events-auto absolute flex flex-col items-center justify-center gap-0.5 rounded-full shadow-lg ring-1 active:scale-95 overflow-hidden ${
                isActive ? 'bg-brand text-white ring-brand/40' : 'bg-white text-brand ring-black/5'
              }`}
              style={{
                left: ANCHOR / 2 + dx,
                top: ANCHOR / 2 + dy,
                width: catSize,
                height: catSize,
                transform: 'translate(-50%, -50%)',
                opacity,
                // Grows and slides out of the corner on open, back in on
                // close — but not while a drag is turning the ring, which it
                // would only lag behind. Staggered along the arc so the fan
                // reads as one motion rather than every button at once.
                transition: drag.current
                  ? 'background-color 150ms, color 150ms'
                  : `left 200ms ease-out ${i * 30}ms, top 200ms ease-out ${i * 30}ms, width 200ms ease-out ${i * 30}ms, height 200ms ease-out ${i * 30}ms, background-color 150ms, color 150ms`,
                touchAction: 'none',
              }}
            >
              <span className={`flex items-center justify-center ${open ? 'w-5 h-5' : 'w-4 h-4 [&_svg]:w-4 [&_svg]:h-4'}`}>{cat.icon}</span>
              <span className={`${open ? 'text-[8px]' : 'text-[6.5px]'} font-semibold leading-none ${isActive ? 'text-white' : 'text-gray-600'}`}>
                {cat.label}
              </span>
            </button>
          )
        })}

        {/* How far along a long list the ring is sitting — without it a
            scrolling arc gives no clue there is more either way. */}
        {open && (outerRing.scrollable || innerRing.scrollable) && (() => {
          // The items ring is the one being worked through, so it gets the
          // counter whenever it scrolls; the categories only claim it when
          // there is no item ring open to speak for.
          const r = outerRing.scrollable
            ? { off: offset.outer, total: outer.length }
            : { off: offset.inner, total: categories.length }
          const pos = wrapArcOffset(Math.round(r.off), r.total) + 1
          return (
            <div
              role="status"
              aria-label={t('studio.arc.position_aria', { pos, total: r.total })}
              className="absolute whitespace-nowrap rounded-full bg-white/85 text-[9px] font-bold text-gray-600 px-1.5 py-0.5 shadow pointer-events-none"
              style={{
                left: ANCHOR / 2 - ARC_RADIUS_OUTER - 6,
                top: ANCHOR / 2 - ARC_RADIUS_OUTER - 6,
                transform: 'translate(-50%, -50%)',
              }}
            >
              {/* Where the ring is sitting, not how far is left: on an
                  endless ring there is no "left". Said in words — a bare
                  "1/21" read as a page number (QA 2026-11-05 #19). */}
              {t('studio.arc.position', { pos, total: r.total })}
            </div>
          )
        })()}

      </div>

      <style>{`
        @keyframes arcpop {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
          to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        @keyframes arcfade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </>
  )
}
