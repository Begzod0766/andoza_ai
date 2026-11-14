import { useEffect, useLayoutEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { StudioTourTarget } from "@/lib/studioTour";

const PAD = 8;
const GAP = 12;

type Box = { left: number; top: number; width: number; height: number };

function measure(id: StudioTourTarget): Box | null {
  const el = document.querySelector(`[data-tour="${id}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return null;
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

/**
 * First-run tour of the Studio: a spotlight over each target in turn, the rest of the view
 * blurred and dimmed. It never marks itself done — `onFinish` (skip or the last step) tells
 * the page, which decides what to remember.
 */
export function StudioTour({ steps, onFinish }: { steps: readonly StudioTourTarget[]; onFinish: () => void }) {
  const { t } = useTranslation();
  // The targets on screen when the tour opens; a step whose target is missing is dropped.
  const [ids] = useState(() => steps.filter((s) => measure(s) !== null));
  const [index, setIndex] = useState(0);
  const id = ids[index];
  const [box, setBox] = useState<Box | null>(() => (id ? measure(id) : null));

  useLayoutEffect(() => {
    if (!id) return;
    const update = () => setBox(measure(id));
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, [id]);

  const empty = ids.length === 0;
  useEffect(() => { if (empty) onFinish(); }, [empty]); // eslint-disable-line react-hooks/exhaustive-deps

  if (empty || !id || !box) return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const left = Math.max(0, box.left - PAD);
  const top = Math.max(0, box.top - PAD);
  const right = Math.min(vw, box.left + box.width + PAD);
  const bottom = Math.min(vh, box.top + box.height + PAD);
  const last = index === ids.length - 1;
  const cardBelow = vh - bottom >= top;
  const cardStyle = cardBelow ? { top: bottom + GAP } : { bottom: vh - top + GAP };

  const shade = "fixed bg-black/55 backdrop-blur-sm";
  const next = () => (last ? onFinish() : setIndex((i) => i + 1));

  return (
    <div className="fixed inset-0 z-[300]">
      <div data-tour-backdrop className={shade} style={{ left: 0, top: 0, width: vw, height: top }} />
      <div data-tour-backdrop className={shade} style={{ left: 0, top: bottom, width: vw, height: Math.max(0, vh - bottom) }} />
      <div data-tour-backdrop className={shade} style={{ left: 0, top, width: left, height: bottom - top }} />
      <div data-tour-backdrop className={shade} style={{ left: right, top, width: Math.max(0, vw - right), height: bottom - top }} />
      <button
        type="button"
        data-tour-hole
        aria-label={t("studio.tour.next")}
        onClick={next}
        className="fixed rounded-2xl bg-transparent ring-2 ring-white/90"
        style={{ left, top, width: right - left, height: bottom - top }}
      />
      <div
        role="dialog"
        aria-label={t(`studio.tour.${id}.title`)}
        className="fixed inset-x-4 mx-auto max-w-sm rounded-2xl bg-card p-4 text-ink shadow-lg ring-1 ring-line"
        style={cardStyle}
      >
        <h2 className="text-base font-semibold">{t(`studio.tour.${id}.title`)}</h2>
        <p className="mt-1 text-sm text-ink-muted">{t(`studio.tour.${id}.body`)}</p>
        <div className="mt-3 flex items-center gap-3">
          <span className="text-xs tabular-nums text-ink-muted">
            {t("studio.tour.step_of", { current: index + 1, total: ids.length })}
          </span>
          <button type="button" onClick={onFinish} className="ml-auto rounded-full px-3 py-1.5 text-sm font-semibold text-ink-muted hover:bg-ink/10">
            {t("studio.tour.skip")}
          </button>
          <button type="button" onClick={next} className="rounded-full bg-brand px-4 py-1.5 text-sm font-semibold text-white">
            {last ? t("studio.tour.done") : t("studio.tour.next")}
          </button>
        </div>
      </div>
    </div>
  );
}
