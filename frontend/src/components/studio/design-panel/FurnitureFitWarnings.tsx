import { useTranslation } from "react-i18next";
import { useFurnitureFitWarnings } from "@/features/studio/fixtureClearance";
import { fixtureDisplayName } from "@/lib/fixtureName";

/**
 * The placed pieces that do not fit where they stand (prod e2e 2026-11-18: a kitchen set 1 m through
 * the wall, no word said): out of the room, in a door's swing, or a tall one before a window. A
 * warning only, nothing is moved.
 */
export function FurnitureFitWarnings() {
  const { t } = useTranslation();
  const warnings = useFurnitureFitWarnings();
  if (warnings.length === 0) return null;
  return (
    <div className="mb-2 space-y-1" data-testid="furniture-fit-warnings">
      {warnings.map((w) => (
        <p key={w.id} role="alert" className="text-[11px] text-red-500">
          {t(`studio.furn.fit_${w.kind}`, { name: fixtureDisplayName(w.name, t) })}
        </p>
      ))}
    </div>
  );
}
