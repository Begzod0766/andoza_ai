import * as React from "react";
import { useTranslation } from "react-i18next";
import type { WallCovering } from "@/store/types";
import { isTileCovering, tileBandM, TILE_BAND_MIN_MM } from "@/lib/tileBand";
import { WALL_COLORS, wallColorName } from "@/lib/wallPalette";

/** The heights offered as chips, mm. One at or above the ceiling is left out. */
const HEIGHT_CHIPS_MM = [1500, 1800, 2100];

/**
 * How high a tiled wall's tile goes, and the paint above it (spec 2026-11-10). Shown for a wall
 * that carries tile; writes `tileHeightMm` and `aboveColor` on its covering through `onChange`.
 */
export function TileHeightControls({ covering, ceilingMm, onChange }: {
  covering: WallCovering;
  ceilingMm: number;
  onChange: (next: WallCovering) => void;
}) {
  const { t } = useTranslation();
  const id = React.useId();
  const tiled = isTileCovering(covering);
  const band = tileBandM(covering, ceilingMm / 1000);
  const bandMm = band == null ? null : Math.round(band * 1000);
  const [typed, setTyped] = React.useState(bandMm == null ? "" : String(bandMm / 10));
  React.useEffect(() => { setTyped(bandMm == null ? "" : String(bandMm / 10)); }, [bandMm]);
  if (!tiled) return null;

  const setHeight = (mm: number | null) => {
    if (mm == null) {
      const { tileHeightMm: _gone, ...rest } = covering;
      onChange(rest as WallCovering);
      return;
    }
    onChange({ ...covering, tileHeightMm: Math.max(TILE_BAND_MIN_MM, Math.round(mm)) });
  };
  const shown = bandMm == null ? "" : String(bandMm / 10);
  /** To the ceiling: the height goes (when there is one) and the field empties. */
  const toCeiling = () => {
    setTyped("");
    if ("tileHeightMm" in covering) setHeight(null);
  };
  const commitTyped = () => {
    if (typed.trim() === "") return toCeiling();
    const cm = Number(typed.replace(",", "."));
    if (!Number.isFinite(cm) || cm <= 0) return setTyped(shown);
    if (cm * 10 >= ceilingMm) return toCeiling();
    setHeight(cm * 10);
  };

  const chip = (on: boolean) =>
    `rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${on ? "border-brand bg-brand text-white" : "border-line text-ink hover:border-brand/50"}`;

  return (
    <div className="space-y-2.5 rounded-xl border border-line bg-card-soft p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{t("studio.tile_height.title")}</p>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" aria-pressed={bandMm == null} className={chip(bandMm == null)} onClick={() => setHeight(null)}>
          {t("studio.tile_height.full")}
        </button>
        {HEIGHT_CHIPS_MM.filter((mm) => mm < ceilingMm).map((mm) => (
          <button key={mm} type="button" aria-pressed={bandMm === mm} className={chip(bandMm === mm)} onClick={() => setHeight(mm)}>
            {(mm / 1000).toFixed(1)} m
          </button>
        ))}
      </div>
      <label htmlFor={`${id}-cm`} className="flex items-center justify-between gap-2 text-xs font-medium text-ink-muted">
        {t("studio.tile_height.custom")}
        <input
          id={`${id}-cm`} inputMode="decimal" value={typed} placeholder={String(Math.round(ceilingMm / 10))}
          onChange={(e) => setTyped(e.target.value)} onBlur={commitTyped}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
          onFocus={(e) => e.currentTarget.scrollIntoView?.({ block: "center", behavior: "smooth" })}
          className="w-20 rounded-lg border border-line bg-card px-2 py-1 text-right text-[12px] text-ink"
        />
      </label>
      {band != null && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-ink-muted">{t("studio.tile_height.above")}</p>
          <div className="flex flex-wrap gap-1.5">
            {WALL_COLORS.map((color) => {
              const on = (covering.aboveColor ?? "#FFFFFF").toLowerCase() === color.toLowerCase();
              return (
                <button
                  key={color} type="button" data-testid="above-swatch" aria-label={wallColorName(color)} aria-pressed={on}
                  onClick={() => onChange({ ...covering, aboveColor: color })}
                  className={`h-6 w-6 rounded-full border ${on ? "ring-2 ring-brand ring-offset-1 ring-offset-card" : "border-line"}`}
                  style={{ background: color }}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
