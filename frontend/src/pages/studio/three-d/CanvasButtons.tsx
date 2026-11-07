import { useTranslation } from "react-i18next";

const round = "flex h-12 min-w-12 items-center justify-center gap-2 rounded-full shadow-lg ring-1 transition-colors md:px-4";
const on = "bg-brand text-white ring-brand/40";
const off = "bg-card/95 text-accent ring-line";

/** The cameras button at the canvas's bottom-left; its name shows beside the icon from md up. */
export function CameraButton({ active, expanded, onClick }: { active: boolean; expanded: boolean; onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <button onClick={onClick} title={t("studio.three_d.kameralar")} aria-label={t("studio.three_d.kameralar")}
      aria-expanded={expanded} className={`${round} ${active ? on : off}`}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2L8 5h8l1.5 2h2A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z" />
        <circle cx="12" cy="12.5" r="3.5" />
      </svg>
      <span className="hidden text-sm font-semibold md:inline" aria-hidden="true">{t("studio.three_d.kameralar")}</span>
    </button>
  );
}

/**
 * The lock: while it is on, taps and holds in the 3D view open nothing, so the room can be
 * turned without a menu popping up. From md up it says so in words ("Tahrirlash: yopiq").
 */
export function LockButton({ locked, onClick, className = "" }: { locked: boolean; onClick: () => void; className?: string }) {
  const { t } = useTranslation();
  const action = locked ? t("studio.three_d.tahrirlashni_yoqish") : t("studio.three_d.tahrirlashni_qulflash");
  return (
    <button onClick={onClick} title={action} aria-label={action} aria-pressed={locked} className={`${round} ${locked ? on : off} ${className}`}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="5" y="11" width="14" height="9" rx="2" />
        {locked ? <path d="M8 11V8a4 4 0 0 1 8 0v3" /> : <path d="M8 11V8a4 4 0 0 1 7.5-1.9" />}
      </svg>
      <span className="hidden text-sm font-semibold md:inline" aria-hidden="true">
        {locked ? t("studio.three_d.tahrir_yopiq") : t("studio.three_d.tahrir_ochiq")}
      </span>
    </button>
  );
}
