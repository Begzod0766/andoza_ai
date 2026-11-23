import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { notifyAppTour, TOUR_SKIP_EVENT, type StudioTourStep, type StudioTourStepId } from "@/lib/studioTour";
import { emitTourEvent, onTourEvent } from "@/lib/studioTourEvents";
import { clearPractice, newFurnitureIds, savePractice } from "@/lib/tourPractice";
import { removePracticeOutOfHistory } from "@/lib/tourHistory";
import { useRoomStore } from "@/store/roomStore";
import { TourHand } from "./TourHand";

const PAD = 8;
const GAP = 12;
const ARROW = 8;
/** The card's side gutters. */
const GUTTER = 16;
/** The ✓ badge (h-12): beside a target smaller than this, not over its text. */
const CHECK = 48;
/** How long the ✓ of a finished `do` step shows before the next step. */
const CHECK_MS = 600;
/** The hand shows the gesture again after this long without a tap. */
const IDLE_MS = 10_000;
/** A hand pointing at something this close to the foot of the screen points down from above
 *  instead: below its fingertip there is no room for it. */
const HAND_FLIP_BOTTOM = 120;
/** A do step's targets must be missing this long, frame after frame, to count as vanished
 *  (an arc re-render or a remounting sheet can drop them for a frame or two). */
const VANISH_MS = 500;
/** The highlight ring's width (ring-2): a target at the view's edge gets its ring inset by this
 *  much, so it is not cut off. */
const RING = 2;
/** How far the hand reaches from its fingertip (TourHand's 48 px tall finger). */
const HAND_H = 48;
/** The space kept between the hand and the card. */
const HAND_GAP = 4;

export type StudioTourFinishReason = "done" | "skip" | "app" | "unmount";

type Box = { left: number; top: number; width: number; height: number };
type Hand = { x: number; y: number; above: boolean };
/** `hand`: where the hand points, when the target names a spot of its own (see `handAt`). */
type Spot = { target: string; box: Box; hand: Hand | null };

function boxOf(id: string): { el: Element; box: Box } | null {
  const el = document.querySelector(`[data-tour="${id}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return null;
  // Entirely off-screen counts as absent: a spotlight over nothing would just hang the tour.
  if (r.right <= 0 || r.bottom <= 0 || r.left >= window.innerWidth || r.top >= window.innerHeight) return null;
  return { el, box: { left: r.left, top: r.top, width: r.width, height: r.height } };
}

function measure(id: string): Box | null {
  return boxOf(id)?.box ?? null;
}

/**
 * Where the hand should point, when the target names a spot of its own: a real button marked
 * `[data-tour-hand-for="<target>"]` anywhere on the page (an arc ring's buttons sit beside its
 * footprint, not in it), else a `[data-tour-hand-at]` child (a stage-list row; a ring's fallback
 * spot on the ring itself), else a height given by `data-tour-hand-y`. `above` when the anchor asks for the hand from above
 * (`data-tour-hand-from="above"`: its label is at its foot). Null when none is laid out.
 */
function handAt(el: Element, target: string, box: Box): Hand | null {
  for (const at of [document.querySelector(`[data-tour-hand-for="${target}"]`), el.querySelector("[data-tour-hand-at]")]) {
    if (!at) continue;
    const r = at.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, above: at.getAttribute("data-tour-hand-from") === "above" };
  }
  // `data-tour-hand-y="0.3"`: that far down the (uncovered) box, centred across it — the scene,
  // whose centre is often a piece of furniture while its upper part is wall.
  const y = parseFloat(el.getAttribute("data-tour-hand-y") ?? "");
  if (Number.isFinite(y)) return { x: box.left + box.width / 2, y: box.top + y * box.height, above: false };
  return null;
}

/** Whether the tour would show this target right now (in the DOM, with a box, on screen). */
export function isTourTargetShown(target: string): boolean {
  return measure(target) !== null;
}

/**
 * The target to spotlight and its box, in one pass: a `show` step's first target; a `do`
 * step's deepest one on screen (the open ring of a menu the user is walking through), else
 * its first. Null when none of them is on screen.
 */
function locate(step: StudioTourStep): Spot | null {
  const deepest = step.kind === "do" ? step.targets.length - 1 : 0;
  for (let i = deepest; i >= 0; i--) {
    const found = boxOf(step.targets[i]);
    if (found) {
      const box = uncovered(found.el, found.box);
      return { target: step.targets[i], box, hand: handAt(found.el, step.targets[i], box) };
    }
  }
  return null;
}

/**
 * The target's box with every `[data-tour-cover]` element that lies over its top or bottom edge
 * cut away (the Studio's floating header sits over the scene): the hole then stops at the
 * header's foot and the shades cover the header too, so its buttons cannot be tapped mid-step.
 * A cover holding the target itself (a header button's own step) is left alone.
 */
function uncovered(el: Element, box: Box): Box {
  let top = box.top;
  let bottom = box.top + box.height;
  document.querySelectorAll("[data-tour-cover]").forEach((cover) => {
    if (cover.contains(el)) return;
    const r = cover.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return;
    if (r.right <= box.left || r.left >= box.left + box.width) return;
    // Over the top edge: the hole starts below it (PAD above the box is the hole's margin).
    if (r.top <= top && r.bottom > top) top = Math.max(top, r.bottom + PAD);
    else if (r.bottom >= bottom && r.top < bottom) bottom = Math.min(bottom, r.top - PAD);
  });
  if (top === box.top && bottom === box.top + box.height) return box;
  return { ...box, top, height: Math.max(0, bottom - top) };
}

const sameSpot = (a: Spot | null, b: Spot) =>
  !!a && a.target === b.target && a.box.left === b.box.left && a.box.top === b.box.top &&
  a.box.width === b.box.width && a.box.height === b.box.height &&
  a.hand?.x === b.hand?.x && a.hand?.y === b.hand?.y && a.hand?.above === b.hand?.above;

/**
 * First-run tour of the Studio: a spotlight over each target in turn, the rest of the view
 * blurred and dimmed. A `show` step points at a button and its hole is the Next button; a `do`
 * step lets the tap through to the target and moves on by itself once the user has done it
 * (picked a surface, added furniture, changed the stage). It never marks itself done —
 * `onFinish` tells the page why it ended, and the page decides what to remember.
 *
 * Every end first restores the view. Done or Skip — or running past the last step after a Next
 * or a ✓ (the steps left had nothing on screen) — then asks whether to keep the furniture added
 * while practising (if any is still there); every other end — the app's Back, the targets of a
 * step on screen vanishing (the 3D view went), an unmount — takes it out without asking. A change of room ends the tour
 * without touching the store (it already holds the new room); the record stays for next time.
 */
export function StudioTour({ steps, roomId, onStepChange, onFinish }: {
  steps: readonly StudioTourStep[];
  roomId: string;
  onStepChange?: (id: StudioTourStepId | null) => void;
  onFinish: (reason: StudioTourFinishReason) => void;
}) {
  const { t } = useTranslation();
  // The targets on screen when the tour opens; a step whose target is missing is dropped.
  const [ids] = useState(() => steps.filter((s) => measure(s.targets[0]) !== null));
  // `gone` counts the steps dropped along the way, so the counter reads "2/6", not "3/7".
  const [pos, setPos] = useState({ index: 0, gone: 0 });
  const { index, gone } = pos;
  const step = ids[index];
  const id = step?.id;
  const isDo = step?.kind === "do";
  const [spot, setSpot] = useState<Spot | null>(() => (step ? locate(step) : null));
  const [cardH, setCardH] = useState(0);
  const cardRef = useRef<HTMLDivElement | null>(null);
  // The index of the `do` step the user has just done (its ✓ is showing).
  const [doneIndex, setDoneIndex] = useState<number | null>(null);
  const checked = doneIndex === index;
  const [replay, setReplay] = useState(0);

  // What the room looked like when the tour opened: new furniture and a changed stage are
  // measured against it.
  const [baseline] = useState(() => {
    const s = useRoomStore.getState();
    return { ids: s.furniture.map((f) => f.id), stage: s.viewStage };
  });
  const furniture = useRoomStore((s) => s.furniture);
  const viewStage = useRoomStore((s) => s.viewStage);
  const added = useMemo(() => newFurnitureIds(baseline.ids, furniture), [baseline, furniture]);
  // The room the tour opened in: its practice record is the only one this tour writes or clears.
  const [tourRoom] = useState(roomId);

  // onFinish fires exactly once, whatever strict-mode effects or a double tap do.
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;
  const onStepChangeRef = useRef(onStepChange);
  onStepChangeRef.current = onStepChange;
  const finishedRef = useRef(false);
  // Once over, nothing is drawn while the page takes the tour away.
  const [over, setOver] = useState(false);
  const close = (reason: StudioTourFinishReason) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setOver(true);
    notifyAppTour(false);
    onStepChangeRef.current?.(null);
    onFinishRef.current(reason);
  };
  // The ids frozen when the question opens: furniture added while it is up is not practice.
  const frozenRef = useRef<string[] | null>(null);
  // The practice furniture still in the room: added since the tour opened (or, once asking,
  // the frozen ids), not deleted since.
  const practiceIds = () => {
    const furniture = useRoomStore.getState().furniture;
    const frozen = frozenRef.current;
    if (!frozen) return newFurnitureIds(baseline.ids, furniture);
    const present = new Set(furniture.map((f) => f.id));
    return frozen.filter((i) => present.has(i));
  };
  // Done or Skip waiting on the keep-or-remove question.
  const [asking, setAsking] = useState<"done" | "skip" | null>(null);
  const askingRef = useRef(false);
  /** `pageGone`: a real unmount. The page's autosave is already disposed, so a removal here
   *  never reaches the server; the record stays for the next Studio open to clean up. */
  const finish = (reason: StudioTourFinishReason, pageGone = false) => {
    if (finishedRef.current) return;
    if (reason === "done" || reason === "skip") {
      if (askingRef.current) return;
      emitTourEvent("restore-view");
      const practice = practiceIds();
      if (practice.length === 0) {
        clearPractice(tourRoom);
        close(reason);
      } else {
        frozenRef.current = practice;
        askingRef.current = true;
        setAsking(reason);
      }
      return;
    }
    emitTourEvent("restore-view");
    const practice = practiceIds();
    removePracticeOutOfHistory(practice);
    if (!pageGone) clearPractice(tourRoom);
    close(reason);
  };
  const answer = (remove: boolean) => {
    if (finishedRef.current || !asking) return;
    const practice = practiceIds();
    if (remove) removePracticeOutOfHistory(practice);
    clearPractice(tourRoom);
    close(asking);
  };
  // Whether a later step's target is on screen (followed every frame on a show step): a rotation
  // can take the rest away, and the step then reads Done instead of running past the end.
  const [tailShown, setTailShown] = useState(true);
  const last = index === ids.length - 1 || (!isDo && !tailShown);
  const next = () => (last ? finish("done") : setPos((p) => ({ ...p, index: p.index + 1 })));

  useLayoutEffect(() => {
    // While the question is up nothing is spotlit, so nothing is followed either.
    if (!step || asking) return;
    // The target vanished: drop this step and move to the next one, which then gets its own
    // grace (the page may hide its target for the current step — the stage pill and camera bar
    // on the furniture step — so it is not judged now). The updater only acts while the
    // position is still on this step, so resize + orientationchange together advance once.
    // Past the last step the tour ends (see `spent`).
    // The previous step's spot is not this step's: dropped, so the grace shows the full shade.
    setSpot((prev) => (prev && step.targets.includes(prev.target) ? prev : null));
    const vanish = () =>
      setPos((p) => {
        if (ids[p.index] !== step) return p;
        return { index: p.index + 1, gone: p.gone + 1 };
      });
    const tail = ids.slice(ids.indexOf(step) + 1);
    // When a check first found no target. Every miss — a frame, a resize or rotation, a step not
    // shown yet — gets VANISH_MS of grace: the page may still be revealing the step's target (it
    // hides the arc and the stage pill until it hears the new step, which lands an effect later
    // than this check), and mid-rotation a target can measure 0×0 for a frame or two while it is
    // in fact still there (phone QA of #377: the camera step was dropped, 7/8 -> 7/7).
    let missingSince: number | null = null;
    const update = (now: number) => {
      const found = locate(step);
      if (step.kind === "show") {
        const shown = tail.some((s) => measure(s.targets[0]) !== null);
        setTailShown((prev) => (prev === shown ? prev : shown));
      }
      if (found) {
        missingSince = null;
        setSpot((prev) => (sameSpot(prev, found) ? prev : found));
      } else if (missingSince === null) missingSince = now;
      else if (now - missingSince >= VANISH_MS) vanish();
    };
    // Re-measured at once (the spotlight follows the new layout); judged like any other frame.
    const onViewChange = () => update(performance.now());
    update(performance.now());
    window.addEventListener("resize", onViewChange);
    window.addEventListener("orientationchange", onViewChange);
    // Followed every frame: a `do` step's target changes as the user opens a menu or a list,
    // and any step's target may only appear a moment after the step starts.
    let raf = 0;
    const loop = () => {
      update(performance.now());
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onViewChange);
      window.removeEventListener("orientationchange", onViewChange);
    };
  }, [step, asking]); // eslint-disable-line react-hooks/exhaustive-deps

  const empty = ids.length === 0;

  // The app hides its Back button while the tour is open, and its system Back skips the tour.
  useEffect(() => {
    if (empty) return;
    notifyAppTour(true);
    const onSkip = () => finish("app");
    window.addEventListener(TOUR_SKIP_EVENT, onSkip);
    return () => {
      window.removeEventListener(TOUR_SKIP_EVENT, onSkip);
      notifyAppTour(false);
    };
  }, [empty]); // eslint-disable-line react-hooks/exhaustive-deps
  // Past the last step ends the tour too — as a normal end, so practice furniture is asked
  // about (a rotation that took the last targets away included), unless the 3D view itself has
  // gone (its scene target stays off the page for VANISH_MS — a rotation can blank it for a frame
  // or two): that is an interruption, cleaned up without asking. With nothing to show at all,
  // nothing was practised.
  const spent = empty || index >= ids.length;
  useEffect(() => {
    if (!spent) return;
    if (empty) return finish("unmount");
    if (isTourTargetShown("scene")) return finish("done");
    // Seen again on any frame: a normal end. Still gone after VANISH_MS: the 3D view went. The
    // timer decides even if frames stop, so the tour never hangs.
    let raf = 0;
    const loop = () => {
      if (isTourTargetShown("scene")) return finish("done");
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const timer = setTimeout(() => {
      cancelAnimationFrame(raf);
      finish(isTourTargetShown("scene") ? "done" : "unmount");
    }, VANISH_MS);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [spent]); // eslint-disable-line react-hooks/exhaustive-deps

  // A real unmount mid-tour cleans up like an interruption. The work waits a microtask and is
  // called off if the effect mounts again, so StrictMode's simulated unmount does nothing.
  const pendingUnmount = useRef<{ cancelled: boolean } | null>(null);
  useEffect(() => {
    if (pendingUnmount.current) pendingUnmount.current.cancelled = true;
    pendingUnmount.current = null;
    return () => {
      const job = { cancelled: false };
      pendingUnmount.current = job;
      queueMicrotask(() => { if (!job.cancelled) finish("unmount", true); });
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Another room: the store now holds that room, so nothing is removed here; the record of
  // the old room's practice furniture stays in storage and is cleaned up when it next opens.
  useEffect(() => {
    if (roomId !== tourRoom) close("unmount");
  }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (id && !finishedRef.current) onStepChangeRef.current?.(id);
  }, [id]);

  // The furniture added since the tour opened is written down on every change, so it can be
  // taken out again even if the app is killed mid-tour.
  const startFurniture = useRef(furniture);
  useEffect(() => {
    if (furniture === startFurniture.current || finishedRef.current || askingRef.current) return;
    savePractice({ roomId: tourRoom, ids: added });
  }, [furniture]); // eslint-disable-line react-hooks/exhaustive-deps

  // Whether the user has done the current `do` step (the surface step hears it as an event).
  const did =
    id === "furniture" ? added.length > 0 :
    id === "stage" ? viewStage !== baseline.stage :
    false;
  useEffect(() => { if (isDo && did && doneIndex !== index) setDoneIndex(index); }, [isDo, did, index]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (id !== "surface" || !isDo) return;
    return onTourEvent("surface-picked", () => setDoneIndex(index));
  }, [id, isDo, index]);
  // The ✓ shows for a moment, then the next step starts (or the tour ends after the last).
  useEffect(() => {
    if (!checked) return;
    const i = index;
    const timer = setTimeout(() => {
      if (i === ids.length - 1) finish("done");
      else setPos((p) => (p.index === i ? { ...p, index: i + 1 } : p));
    }, CHECK_MS);
    return () => clearTimeout(timer);
  }, [checked, index]); // eslint-disable-line react-hooks/exhaustive-deps

  // The hand shows the gesture again after a while without a tap; a new step or target restarts the wait.
  const spotTarget = spot?.target;
  useEffect(() => {
    if (!isDo || checked) return;
    const bump = () => setReplay((r) => r + 1);
    let timer = setTimeout(bump, IDLE_MS);
    const onDown = () => {
      clearTimeout(timer);
      timer = setTimeout(bump, IDLE_MS);
    };
    window.addEventListener("pointerdown", onDown, true);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointerdown", onDown, true);
    };
  }, [isDo, checked, id, spotTarget, replay]);

  // The question takes the focus (the Done/Skip button that opened it is gone).
  const removeRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => { if (asking) removeRef.current?.focus(); }, [asking]);

  useLayoutEffect(() => {
    const h = cardRef.current?.getBoundingClientRect().height ?? 0;
    if (h !== cardH) setCardH(h);
  });

  if (over) return null;
  if (asking) {
    // The question alone: no spotlight, no shade. The app still hears the tour as open. Not
    // aria-modal: the Studio behind it stays live.
    return (
      <div className="pointer-events-none fixed inset-0 z-[300]">
        <div
          role="alertdialog"
          aria-labelledby="studio-tour-practice-q"
          className="pointer-events-auto fixed inset-x-4 bottom-6 mx-auto max-w-sm rounded-2xl bg-card p-4 text-ink shadow-lg ring-1 ring-line"
        >
          <p id="studio-tour-practice-q" className="text-sm font-medium">{t("studio.tour.practice_question")}</p>
          <div className="mt-3 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => answer(false)}
              className="rounded-full px-4 py-1.5 text-sm font-semibold text-ink-muted hover:bg-ink/10"
            >
              {t("studio.tour.practice_keep")}
            </button>
            <button
              ref={removeRef}
              type="button"
              onClick={() => answer(true)}
              className="rounded-full bg-brand px-4 py-1.5 text-sm font-semibold text-white"
            >
              {t("studio.tour.practice_remove")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (empty || !id) return null;
  const shade = "pointer-events-auto fixed bg-black/55 backdrop-blur-sm";
  // A new step whose target is not on screen yet (the page is still revealing it): no spot of
  // its own, so everything is covered — no hole, no card — until the target shows or the step
  // is dropped.
  if (!spot || !step.targets.includes(spot.target)) {
    return (
      <div className="pointer-events-none fixed inset-0 z-[300]">
        <div data-tour-backdrop className={`${shade} inset-0`} />
      </div>
    );
  }
  const { box } = spot;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  // The hole and its ring, inset RING px from the view's edges so the ring is never cut off.
  const left = Math.max(RING, box.left - PAD);
  const top = Math.max(RING, box.top - PAD);
  const right = Math.min(vw - RING, box.left + box.width + PAD);
  const bottom = Math.min(vh - RING, box.top + box.height + PAD);
  const cx = box.left + box.width / 2;
  const cy = box.top + box.height / 2;
  const handX = spot.hand?.x ?? cx;
  const handY = spot.hand?.y ?? cy;
  const handAbove = !!spot.hand?.above || handY > vh - HAND_FLIP_BOTTOM;
  const showHand = isDo && !checked;
  // Below the target if there is more room there, else above; clear of the hand, which reaches
  // HAND_H past its fingertip (up from a hand pointing from above, down otherwise); then kept
  // fully inside the view (a big target can leave no room either side, and the card then sits
  // over its edge).
  const below = vh - bottom >= top;
  const clamp = (y: number) => Math.max(PAD, Math.min(y, vh - cardH - PAD));
  let cardTop = clamp(below ? bottom + GAP : top - GAP - cardH);
  if (showHand) {
    // The hand's reach on screen; a card over it moves just past it — the preferred side first,
    // else the other — when the card fits there, and stays put when it fits on neither side.
    const handTop = handAbove ? handY - HAND_H : handY;
    const handBottom = handAbove ? handY : handY + HAND_H;
    if (cardTop < handBottom + HAND_GAP && cardTop + cardH > handTop - HAND_GAP) {
      const over = handTop - HAND_GAP - cardH;
      const under = handBottom + HAND_GAP;
      const fits = (y: number) => y >= PAD && y + cardH <= vh - PAD;
      const order = below ? [under, over] : [over, under];
      const clear = order.find(fits);
      if (clear !== undefined) cardTop = clear;
    }
  }

  // The card: 16px gutters, 384px at most, centred under (or over) the target as far as the
  // view allows — in landscape a centred card left its arrow ~190px short of a corner button.
  const cardW = Math.min(vw - 2 * GUTTER, 384);
  const cardLeft = Math.max(GUTTER, Math.min(cx - cardW / 2, vw - GUTTER - cardW));
  const cardStyle = { top: cardTop, left: cardLeft, width: cardW, maxHeight: vh - 2 * PAD };
  // A show step's arrow: a CSS triangle on the card's edge, pointing at the target's centre
  // (clear of the card's rounded corners), when the card sits clear of the target.
  const arrowLeft = Math.max(cardLeft + 16, Math.min(cx, cardLeft + cardW - 16)) - ARROW;
  const arrow = isDo ? null
    : cardTop >= bottom ? { top: cardTop - ARROW, up: true }
    : cardTop + cardH <= top ? { top: cardTop + cardH, up: false }
    : null;

  // The ✓ of a done step: over a big target's centre (the scene), beside a small one (the
  // stage pill), so it does not hide the text the user has just changed.
  const small = box.width < 3 * CHECK && box.height < 3 * CHECK;
  const check = !small ? { left: cx, top: cy }
    : right + GAP + CHECK <= vw ? { left: right + GAP + CHECK / 2, top: cy }
    : { left: Math.max(CHECK / 2, left - GAP - CHECK / 2), top: cy };

  const body = t(`studio.tour.${id}.body`);
  // On a do step Skip is a small text link, so the counter row stays one compact line.
  const skip = (
    <button
      type="button"
      onClick={() => finish("skip")}
      className={isDo
        ? "shrink-0 rounded px-1 py-0.5 text-xs font-medium text-ink-muted underline-offset-2 hover:underline"
        : "shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold text-ink-muted hover:bg-ink/10"}
    >
      {t("studio.tour.skip")}
    </button>
  );
  const counter = (
    <span className="shrink-0 text-xs tabular-nums text-ink-muted">
      {t("studio.tour.step_of", { current: index + 1 - gone, total: last ? index + 1 - gone : ids.length - gone })}
    </span>
  );

  // The overlay itself lets taps through; only the four shades, the card and (on a show step)
  // the hole button catch them. On a do step the hole is open, so the tap lands on the target.
  return (
    <div className="pointer-events-none fixed inset-0 z-[300]">
      <div data-tour-backdrop className={shade} style={{ left: 0, top: 0, width: vw, height: top }} />
      <div data-tour-backdrop className={shade} style={{ left: 0, top: bottom, width: vw, height: Math.max(0, vh - bottom) }} />
      <div data-tour-backdrop className={shade} style={{ left: 0, top, width: left, height: bottom - top }} />
      <div data-tour-backdrop className={shade} style={{ left: right, top, width: Math.max(0, vw - right), height: bottom - top }} />
      {isDo ? (
        <div
          data-tour-ring
          className="pointer-events-none fixed rounded-2xl ring-2 ring-white/90"
          style={{ left, top, width: right - left, height: bottom - top }}
        />
      ) : (
        <button
          type="button"
          data-tour-hole
          aria-label={t("studio.tour.next")}
          onClick={next}
          className="pointer-events-auto fixed rounded-2xl bg-transparent ring-2 ring-white/90"
          style={{ left, top, width: right - left, height: bottom - top }}
        />
      )}
      {showHand && (
        <div data-tour-hand>
          <TourHand key={spot.target} x={handX} y={handY} above={handAbove} replayKey={replay} />
        </div>
      )}
      {checked && (
        <div
          data-tour-check
          aria-hidden="true"
          className="fixed flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-brand text-2xl font-bold text-white shadow-lg"
          style={check}
        >
          ✓
        </div>
      )}
      {arrow && (
        <>
          {/* An outline in the card ring's colour, a pixel larger, so the notch reads against
              a light scene as well as the card does. */}
          <div
            data-tour-arrow-outline
            aria-hidden="true"
            className={`fixed h-0 w-0 border-x-[9px] border-x-transparent drop-shadow-md ${arrow.up ? "border-b-[9px] border-b-line" : "border-t-[9px] border-t-line"}`}
            style={{ left: arrowLeft - 1, top: arrow.up ? arrow.top - 1 : arrow.top }}
          />
          <div
            data-tour-arrow
            aria-hidden="true"
            className={`fixed h-0 w-0 border-x-8 border-x-transparent ${arrow.up ? "border-b-8 border-b-card" : "border-t-8 border-t-card"}`}
            style={{ left: arrowLeft, top: arrow.top }}
          />
        </>
      )}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal={isDo ? undefined : "true"}
        aria-label={body}
        className="pointer-events-auto fixed overflow-y-auto rounded-2xl bg-card p-4 text-ink shadow-lg ring-1 ring-line"
        style={cardStyle}
      >
        {isDo ? (
          <>
            <p className="text-sm font-medium">{body}</p>
            <div className="mt-1.5 flex items-center justify-between gap-3">
              {counter}
              {skip}
            </div>
          </>
        ) : (
          <>
            <p className="text-sm">{body}</p>
            <div className="mt-3 flex items-center gap-3">
              {counter}
              <span className="ml-auto">{skip}</span>
              <button type="button" onClick={next} className="rounded-full bg-brand px-4 py-1.5 text-sm font-semibold text-white">
                {last ? t("studio.tour.done") : t("studio.tour.next")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
