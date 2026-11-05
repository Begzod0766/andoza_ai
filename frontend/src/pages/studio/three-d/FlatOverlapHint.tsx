import { useTranslation } from "react-i18next";

/**
 * Shown over the flat view when two rooms' saved positions put them inside
 * each other (lib/flatBoxes' `overlappingRooms`). Stored positions are the
 * user's own layout, so the studio does not move rooms behind their back; it
 * says so and points at the "Move rooms" tool. Non-blocking: it takes no
 * taps, so the canvas under it still orbits.
 */
export function FlatOverlapHint() {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      className="pointer-events-none max-w-xs rounded-xl bg-card/95 px-3 py-2 text-xs font-medium text-ink shadow-md ring-1 ring-line"
    >
      {t("studio.three_d.xonalar_ustma_ust")}
    </div>
  );
}
