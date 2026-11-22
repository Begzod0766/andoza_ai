import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { notifyAppTour, TOUR_SKIP_EVENT, type StudioTourStep, type StudioTourStepId } from "@/lib/studioTour";
import { emitTourEvent, onTourEvent } from "@/lib/studioTourEvents";
import { clearPractice, newFurnitureIds, savePractice } from "@/lib/tourPractice";
import { useRoomStore } from "@/store/roomStore";
import { TourHand } from "./TourHand";

const PAD = 8;
const GAP = 12;
const ARROW = 8;
/** How long the ✓ of a finished `do` step shows before the next step. */
const CHECK_MS = 600;
/** The hand shows the gesture again after this long without a tap. */
const IDLE_MS = 10_000;
/** A do step's targets must be missing this long, frame after frame, to count as vanished
 *  (an arc re-render or a remounting sheet can drop them for a frame or two). */
const VANISH_MS = 500;

export type StudioTourFinishReason = "done" | "skip" | "app" | "unmount";

type Box = { left: number; top: number; width: number; height: number };
type Point = { x: number; y: number };
/** `hand`: where the hand points, when the target names a spot of its own (see `handAt`). */
type Spot = { target: string; box: Box; hand: Point | null };

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

/** A target can name where the hand should point with a `[data-tour-hand-at]` child (an arc
 *  ring points at the ring itself, not its footprint's centre); null when it has none laid out. */
function handAt(el: Element): Point | null {
  const at = el.querySelector("[data-tour-hand-at]");
  if (!at) return null;
  const r = at.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return null;
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
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
    if (found) return { target: step.targets[i], box: found.box, hand: handAt(found.el) };
  }
  return null;
}

const sameSpot = (a: Spot | null, b: Spot) =>
  !!a && a.target === b.target && a.box.left === b.box.left && a.box.top === b.box.top &&
  a.box.width === b.box.width && a.box.height === b.box.height &&
  a.hand?.x === b.hand?.x && a.hand?.y === b.hand?.y;

/**
 * First-run tour of the Studio: a spotlight over each target in turn, the rest of the view
 * blurred and dimmed. A `show` step points at a button and its hole is the Next button; a `do`
 * step lets the tap through to the target and moves on by itself once the user has done it
 * (picked a surface, added furniture, changed the stage). It never marks itself done —
 * `onFinish` tells the page why it ended, and the page decides what to remember.
 *
 * Every end first restores the view. Done or Skip then asks whether to keep the furniture
 * added while practising (if any is still there); every other end — the app's Back, the
 * targets vanishing, an unmount — takes it out without asking. A change of room ends the tour
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
    if (practice.length > 0) useRoomStore.getState().removeFurnitureMany(practice);
    if (!pageGone) clearPractice(tourRoom);
    close(reason);
  };
  const answer = (remove: boolean) => {
    if (finishedRef.current || !asking) return;
    const practice = practiceIds();
    if (remove && practice.length > 0) useRoomStore.getState().removeFurnitureMany(practice);
    clearPractice(tourRoom);
    close(asking);
  };
  const last = index === ids.length - 1;
  const next = () => (last ? finish("done") : setPos((p) => ({ ...p, index: p.index + 1 })));

  useLayoutEffect(() => {
    // While the question is up nothing is spotlit, so nothing is followed either.
    if (!step || asking) return;
    // The target vanished: move to the next step still on screen (the updater only acts
    // while the position is still on this step, so resize + orientationchange together
    // advance once), or end when none is left.
    const vanish = () =>
      setPos((p) => {
        if (ids[p.index] !== step) return p;
        let k = p.index + 1;
        while (k < ids.length && !locate(ids[k])) k++;
        return { index: k, gone: p.gone + 1 + (k - p.index - 1) };
      });
    // When a check first found no target. A resize or rotation decides at once; every other
    // miss — a frame, or the first check of a new step — gets VANISH_MS of grace: the page may
    // still be revealing the step's target (it hides the arc and the stage pill until it hears
    // the new step, which lands an effect later than this check).
    let missingSince: number | null = null;
    const update = (now: number | null) => {
      const found = locate(step);
      if (found) {
        missingSince = null;
        setSpot((prev) => (sameSpot(prev, found) ? prev : found));
      } else if (now === null) vanish();
      else if (missingSince === null) missingSince = now;
      else if (now - missingSince >= VANISH_MS) vanish();
    };
    const onViewChange = () => update(null);
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
  // Past the last step (nothing left on screen after a rotation) ends the tour too.
  const spent = empty || index >= ids.length;
  useEffect(() => { if (spent) finish("unmount"); }, [spent]); // eslint-disable-line react-hooks/exhaustive-deps

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

  if (empty || !id || !spot) return null;
  const shade = "pointer-events-auto fixed bg-black/55 backdrop-blur-sm";
  // A new step whose target is not on screen yet (the page is still revealing it): the old
  // spot is stale, so everything is covered until the target shows or the step is dropped.
  if (!step.targets.includes(spot.target)) {
    return (
      <div className="pointer-events-none fixed inset-0 z-[300]">
        <div data-tour-backdrop className={`${shade} inset-0`} />
      </div>
    );
  }
  const { box } = spot;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const left = Math.max(0, box.left - PAD);
  const top = Math.max(0, box.top - PAD);
  const right = Math.min(vw, box.left + box.width + PAD);
  const bottom = Math.min(vh, box.top + box.height + PAD);
  // Below the target if there is more room there, else above; then kept fully inside the view
  // (a big target can leave no room either side, and the card then sits over its edge).
  const wanted = vh - bottom >= top ? bottom + GAP : top - GAP - cardH;
  const cardTop = Math.max(PAD, Math.min(wanted, vh - cardH - PAD));
  const cardStyle = { top: cardTop, maxHeight: vh - 2 * PAD };
  const cx = box.left + box.width / 2;
  const cy = box.top + box.height / 2;

  // A show step's arrow: a CSS triangle on the card's edge, pointing at the target, when the
  // card sits clear of it. The card is `inset-x-4 mx-auto max-w-sm` (16px gutters, 384px max).
  const cardW = Math.min(vw - 32, 384);
  const cardLeft = (vw - cardW) / 2;
  const arrowLeft = Math.max(cardLeft + 16, Math.min(cx, cardLeft + cardW - 16)) - ARROW;
  const arrow = isDo ? null
    : cardTop >= bottom ? { top: cardTop - ARROW, up: true }
    : cardTop + cardH <= top ? { top: cardTop + cardH, up: false }
    : null;

  const body = t(`studio.tour.${id}.body`);
  const skip = (
    <button
      type="button"
      onClick={() => finish("skip")}
      className="shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold text-ink-muted hover:bg-ink/10"
    >
      {t("studio.tour.skip")}
    </button>
  );
  const counter = (
    <span className="shrink-0 text-xs tabular-nums text-ink-muted">
      {t("studio.tour.step_of", { current: index + 1 - gone, total: ids.length - gone })}
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
      {isDo && !checked && (
        <div data-tour-hand>
          <TourHand key={spot.target} x={spot.hand?.x ?? cx} y={spot.hand?.y ?? cy} replayKey={replay} />
        </div>
      )}
      {checked && (
        <div
          data-tour-check
          aria-hidden="true"
          className="fixed flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-brand text-2xl font-bold text-white shadow-lg"
          style={{ left: cx, top: cy }}
        >
          ✓
        </div>
      )}
      {arrow && (
        <div
          data-tour-arrow
          aria-hidden="true"
          className={`fixed h-0 w-0 border-x-8 border-x-transparent ${arrow.up ? "border-b-8 border-b-card" : "border-t-8 border-t-card"}`}
          style={{ left: arrowLeft, top: arrow.top }}
        />
      )}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal={isDo ? undefined : "true"}
        aria-label={body}
        className="pointer-events-auto fixed inset-x-4 mx-auto max-w-sm overflow-y-auto rounded-2xl bg-card p-4 text-ink shadow-lg ring-1 ring-line"
        style={cardStyle}
      >
        {isDo ? (
          <div className="flex items-center gap-3">
            {counter}
            <p className="min-w-0 flex-1 text-sm font-medium">{body}</p>
            {skip}
          </div>
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
