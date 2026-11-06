import { useTranslation } from "react-i18next";

/**
 * Shown over the flat view when two rooms' saved positions put them inside
 * each other (lib/flatBoxes' `overlappingRooms`). Stored positions are the
 * user's own layout, so the studio does not move rooms behind their back; it
 * says so and points at the "Move rooms" tool. Non-blocking: it takes no
 * taps, so the canvas under it still orbits.
 *
 * It places itself: centred, BELOW the header row (`top-16`). On a phone and
 * in the native app the header floats over the 3D view with its title pill
 * centred at the top and above the scene (z-30); at `top-3` the hint sat
 * right under that pill and could not be seen (QA 2026-11-06 1.10, #175).
 */
export function FlatOverlapHint() {
  const { t } = useTranslation();
  return (
    <div className="pointer-events-none absolute left-1/2 top-16 z-20 -translate-x-1/2">
      <div
        role="status"
        className="pointer-events-none max-w-xs rounded-xl bg-card/95 px-3 py-2 text-xs font-medium text-ink shadow-md ring-1 ring-line"
      >
        {t("studio.three_d.xonalar_ustma_ust")}
      </div>
    </div>
  );
}
