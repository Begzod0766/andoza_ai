import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { PhaseKey, RENO_STAGES } from "@/lib/phases";
import type { ViewStage } from "@/lib/stageView";

/**
 * The stages on a phone (spec 2026-11-18): one small pill over the 3D saying which stage it draws,
 * opening the room's stages and "Tayyor xona". The desktop has the left stage list instead; the
 * phone's own list and pill were taken out earlier (2026-09-28, 2026-11-07) for being in the way,
 * so this stays one pill until tapped.
 */
export function MobileStagePicker({ stages, view, onPick, onFull, onOpenChange }: {
  stages: typeof RENO_STAGES;
  view: ViewStage;
  onPick: (phase: PhaseKey) => void;
  onFull: () => void;
  /** Told when the list opens or closes: the page lifts the pill over the 3D's own buttons while it is open. */
  onOpenChange?: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpenState] = useState(false);
  const setOpen = (next: boolean | ((v: boolean) => boolean)) => setOpenState((v) => {
    const value = typeof next === "function" ? next(v) : next;
    if (value !== v) onOpenChange?.(value);
    return value;
  });
  const full = t("studio.stage_view.full");
  const current = view === "full" ? full : t(stages.find((s) => s.key === view)?.labelKey ?? "studio.stage_view.full");
  const item = (active: boolean) =>
    `block w-full rounded-lg px-3 py-1.5 text-left text-[12px] ${active ? "bg-brand text-white" : "text-ink hover:bg-card-soft"}`;
  return (
    <div className="pointer-events-auto relative z-10 lg:hidden">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        aria-label={`${t("studio.stage_view.stage")}: ${current}`}
        className="flex items-center gap-1 rounded-full border border-line bg-card/95 px-3 py-1.5 text-[12px] font-semibold text-ink shadow-md backdrop-blur">
        <span className="text-ink-muted">{t("studio.stage_view.stage")}:</span> {current}
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"
          style={{ transform: open ? "rotate(180deg)" : undefined }}><path d="M2 3.5l3 3 3-3" /></svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 w-44 space-y-0.5 rounded-xl border border-line bg-card p-1 shadow-xl">
          {stages.map((s) => (
            <button key={s.key} type="button" className={item(view === s.key)}
              onClick={() => { onPick(s.key); setOpen(false); }}>{t(s.labelKey)}</button>
          ))}
          <button type="button" className={item(view === "full")}
            onClick={() => { onFull(); setOpen(false); }}>{full}</button>
        </div>
      )}
    </div>
  );
}
