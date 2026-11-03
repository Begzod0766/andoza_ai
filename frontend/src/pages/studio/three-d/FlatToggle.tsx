import { useTranslation } from "react-i18next";

/**
 * Switches the canvas between the room being edited and the whole flat. It names where it
 * takes you: "Kvartira" while a room is shown alone, "Xona" while the flat is.
 */
export function FlatToggle({ flat, onToggle }: { flat: boolean; onToggle: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      aria-pressed={flat}
      onClick={onToggle}
      title={flat ? t("studio.three_d.faqat_shu_xona") : t("studio.three_d.hamma_xonalar")}
      className="flex h-11 items-center gap-1.5 rounded-full bg-card px-4 text-sm font-semibold text-ink shadow-md ring-1 ring-line hover:bg-card-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {flat
          ? <path d="M4 9V6a2 2 0 0 1 2-2h3M15 4h3a2 2 0 0 1 2 2v3M20 15v3a2 2 0 0 1-2 2h-3M9 20H6a2 2 0 0 1-2-2v-3" />
          : <path d="M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />}
      </svg>
      {flat ? t("studio.three_d.xona") : t("studio.three_d.kvartira")}
    </button>
  );
}
