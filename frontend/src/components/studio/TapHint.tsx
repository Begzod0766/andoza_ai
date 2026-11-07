import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { RENO_STAGES, type PhaseKey } from "@/lib/phases";

const SEEN_KEY = "studio.tapHint.seen";

/** Whether the phone hint was seen; a storage that is missing or throws just shows it again next time. */
export function useTapHintSeen(): [boolean, () => void] {
  const [seen, setSeen] = useState(() => {
    try { return localStorage.getItem(SEEN_KEY) === "1"; } catch { return false; }
  });
  const markSeen = () => {
    setSeen(true);
    try { localStorage.setItem(SEEN_KEY, "1"); } catch { /* shown again next time */ }
  };
  return [seen, markSeen];
}

/** The hint shows until it is seen, and never while the view is locked — a tap opens nothing then. */
export function shouldShowTapHint({ seen, locked }: { seen: boolean; locked: boolean }): boolean {
  return !seen && !locked;
}

/**
 * On a phone the tools are reached by tapping a surface (the stage list was removed from the
 * header on 2026-09-28) — and nothing said so. This says it once, over the bottom of the view.
 */
export function TapHint({ onDismiss }: { onDismiss: () => void }) {
  const { t } = useTranslation();
  return (
    <div role="status" className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-card/95 px-4 py-3 text-sm text-ink shadow-lg ring-1 ring-line">
      <span className="min-w-0 flex-1">{t("studio.tap_hint")}</span>
      <button type="button" onClick={onDismiss} aria-label={t("common.yopish")}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-ink/10">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );
}

/**
 * The phone's room line: the header hides the room's name under sm, so the view says which room
 * and stage.
 *
 * It is also the phone's way between stages. The stage rail is desktop-only (PhaseStageNav,
 * `hidden lg:flex`) and the pill could not be tapped, so on a phone the stage never changed and
 * the pill said "Paint/Wallpaper" forever (QA 2026-11-05 #17). A tap opens the stage list under
 * it; a pick goes to that stage and closes it. Without `onPick` it is the plain label it was.
 *
 * A press anywhere else closes the list, heard in the capture phase and never stopped: an
 * overlay that swallowed the press would cost the user the drag it started.
 */
export function StagePill({ roomName, phase, onPick, onOpenChange }: {
  roomName: string;
  phase: PhaseKey;
  onPick?: (phase: PhaseKey) => void;
  /** Told each time the stage list opens or closes (StagePillLayer lifts itself while it is open). */
  onOpenChange?: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;
  useEffect(() => { onOpenChangeRef.current?.(open); }, [open]);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const stage = RENO_STAGES.find((s) => s.key === phase);
  const text = stage ? `${roomName} · ${t(stage.labelKey)}` : roomName;

  useEffect(() => {
    if (!open) return;
    const onPress = (e: Event) => {
      if (rootRef.current && e.target instanceof Node && rootRef.current.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("pointerdown", onPress, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPress, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pillClass = "max-w-[70vw] truncate rounded-full bg-card/90 px-3 py-1 text-xs font-semibold text-ink shadow ring-1 ring-line";
  if (!onPick) return <p className={pillClass}>{text}</p>;

  return (
    <div ref={rootRef} className="pointer-events-auto relative flex flex-col items-center">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        className={`${pillClass} flex items-center gap-1 active:scale-95`}
      >
        <span className="truncate">{text}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
          className="shrink-0" style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform 0.15s ease" }}>
          <path d="M2 3.5l3 3 3-3" />
        </svg>
      </button>
      {open && (
        <ul
          aria-label={t("studio.three_d.bosqichni_tanlash")}
          className="mt-1 min-w-[12rem] overflow-hidden rounded-2xl bg-card py-1 shadow-lg ring-1 ring-line"
        >
          {RENO_STAGES.map((s, i) => {
            const current = s.key === phase;
            return (
              <li key={s.key}>
                <button
                  type="button"
                  onClick={() => { setOpen(false); onPick(s.key); }}
                  aria-current={current ? "step" : undefined}
                  className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold ${
                    current ? "bg-brand text-white" : "text-ink hover:bg-card-soft"
                  }`}
                >
                  <span aria-hidden="true" className={`w-4 text-xs tabular-nums ${current ? "text-white/80" : "text-ink-muted"}`}>{i + 1}</span>
                  <span>{t(s.labelKey)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * Above every label the 3D scene floats over the canvas. Those are drei <Html> overlays with
 * zIndexRange tops up to 210 (the room's blue focus button is 90) and they share a stacking
 * context with the pill's layer, so at z-20 the open list was drawn under them: the focus
 * button showed between "Light fixtures" and "Furniture" (Begzod0766/andoza_ai#181). A test
 * scans the sources so a new, higher label cannot slip back over it.
 */
export const STAGE_LIST_Z = 300;

/**
 * The phone's pill in its place at the top of the view. It sits at z-20 with the other corner
 * controls, and rises to STAGE_LIST_Z only while its list is open — permanently that high, it
 * would also cover the panels and the drop overlay (z-40/50) that are meant to cover it.
 */
export function StagePillLayer(props: { roomName: string; phase: PhaseKey; onPick: (phase: PhaseKey) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="pointer-events-none absolute inset-x-0 top-3 z-20 flex justify-center lg:hidden"
      style={open ? { zIndex: STAGE_LIST_Z } : undefined}>
      <StagePill {...props} onOpenChange={setOpen} />
    </div>
  );
}
