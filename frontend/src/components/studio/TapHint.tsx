import { useState } from "react";
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

/** The phone's room line: the header hides the room's name under sm, so the view says which room and stage. */
export function StagePill({ roomName, phase }: { roomName: string; phase: PhaseKey }) {
  const { t } = useTranslation();
  const stage = RENO_STAGES.find((s) => s.key === phase);
  return (
    <p className="max-w-[70vw] truncate rounded-full bg-card/90 px-3 py-1 text-xs font-semibold text-ink shadow ring-1 ring-line">
      {stage ? `${roomName} · ${t(stage.labelKey)}` : roomName}
    </p>
  );
}
