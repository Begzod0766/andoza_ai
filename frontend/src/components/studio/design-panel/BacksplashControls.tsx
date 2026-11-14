import * as React from "react";
import { useTranslation } from "react-i18next";
import type { Backsplash, RoomGeometry } from "@/store/types";
import { BACKSPLASH_COLOR, backsplashAreaM2, backsplashPieces, newBacksplash } from "@/lib/backsplash";
import { WALL_COLORS, wallColorName } from "@/lib/wallPalette";
import { wallNumber } from "@/lib/wallLabel";

/** The usual heights, mm: worktop to wall cabinets. */
const HEIGHT_CHIPS: ReadonlyArray<[number, number]> = [[850, 1450], [900, 1500], [850, 1600]];
/** Glass colours offered besides the wall palette: white, black, a warm grey. */
const SKINALI_COLORS = ["#FFFFFF", "#1F2937", "#9CA3AF"];

/**
 * A kitchen's backsplashes (spec 2026-11-14): add one on the picked wall, and set each one's wall,
 * place, height, material and colour. Writes the whole list through `onChange`.
 */
export function BacksplashControls({ geometry, ceilingMm, targetWall, value, onChange }: {
  geometry: RoomGeometry;
  ceilingMm: number;
  targetWall: string;
  value: Backsplash[] | undefined;
  onChange: (next: Backsplash[]) => void;
}) {
  const { t } = useTranslation();
  const list = value ?? [];
  const walls = geometry.walls;
  const add = () => {
    const wallId = walls.some((w) => w.id === targetWall) ? targetWall : walls[0]?.id;
    if (wallId) onChange([...list, newBacksplash(geometry, wallId)]);
  };
  const patch = (id: string, p: Partial<Backsplash>) => onChange(list.map((b) => (b.id === id ? { ...b, ...p } : b)));

  return (
    <div className="space-y-3 rounded-xl border border-line bg-card-soft p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{t("studio.backsplash.title")}</p>
      {list.map((b) => (
        <BacksplashRow key={b.id} b={b} geometry={geometry} ceilingMm={ceilingMm} t={t}
          onPatch={(p) => patch(b.id, p)} onRemove={() => onChange(list.filter((x) => x.id !== b.id))} wallIds={walls.map((w) => w.id)} />
      ))}
      <button type="button" onClick={add}
        className="w-full rounded-lg border border-dashed border-brand/60 py-1.5 text-[12px] font-medium text-brand hover:bg-brand/5">
        {t("studio.backsplash.add")}
      </button>
    </div>
  );
}

function CmField({ label, mm, onCommit }: { label: string; mm: number; onCommit: (mm: number) => void }) {
  const id = React.useId();
  const [typed, setTyped] = React.useState(String(Math.round(mm / 10)));
  React.useEffect(() => { setTyped(String(Math.round(mm / 10))); }, [mm]);
  const commit = () => {
    const cm = Number(typed.replace(",", "."));
    if (!Number.isFinite(cm) || cm < 0) return setTyped(String(Math.round(mm / 10)));
    onCommit(Math.round(cm * 10));
  };
  return (
    <label htmlFor={id} className="flex items-center justify-between gap-2 text-xs font-medium text-ink-muted">
      {label}
      <input id={id} inputMode="decimal" value={typed} onChange={(e) => setTyped(e.target.value)} onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
        onFocus={(e) => e.currentTarget.scrollIntoView?.({ block: "center", behavior: "smooth" })}
        className="w-20 rounded-lg border border-line bg-card px-2 py-1 text-right text-[12px] text-ink" />
    </label>
  );
}

function BacksplashRow({ b, geometry, ceilingMm, wallIds, onPatch, onRemove, t }: {
  b: Backsplash; geometry: RoomGeometry; ceilingMm: number; wallIds: string[];
  onPatch: (p: Partial<Backsplash>) => void; onRemove: () => void; t: (k: string, o?: Record<string, unknown>) => string;
}) {
  const wallId = React.useId();
  const wallLen = geometry.walls.find((w) => w.id === b.wallId)?.length ?? 0;
  const area = backsplashAreaM2(backsplashPieces(b, geometry, ceilingMm));
  const chip = (on: boolean) =>
    `rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${on ? "border-brand bg-brand text-white" : "border-line text-ink hover:border-brand/50"}`;
  const colors = b.material === "skinali" ? SKINALI_COLORS : WALL_COLORS;
  return (
    <div className="space-y-2 rounded-lg border border-line bg-card p-2.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={wallId} className="flex items-center gap-2 text-xs font-medium text-ink-muted">
          {t("studio.backsplash.wall")}
          <select id={wallId} value={b.wallId} onChange={(e) => onPatch({ wallId: e.target.value })}
            className="rounded-lg border border-line bg-card px-2 py-1 text-[12px] text-ink">
            {wallIds.map((id) => <option key={id} value={id}>{t("studio.backsplash.wall_n", { n: wallNumber(id) })}</option>)}
          </select>
        </label>
        <span className="text-[12px] font-semibold text-ink">{area.toFixed(2)} m²</span>
      </div>
      <div className="flex gap-1.5">
        {(["tile", "skinali"] as const).map((m) => (
          <button key={m} type="button" aria-pressed={b.material === m} className={chip(b.material === m)}
            onClick={() => b.material !== m && onPatch({ material: m, color: BACKSPLASH_COLOR[m] })}>
            {t(`studio.backsplash.${m}`)}
          </button>
        ))}
      </div>
      <CmField label={t("studio.backsplash.start")} mm={b.startMm}
        onCommit={(mm) => onPatch({ startMm: Math.min(Math.max(0, wallLen - 100), mm) })} />
      <CmField label={t("studio.backsplash.length")} mm={b.lengthMm}
        onCommit={(mm) => onPatch({ lengthMm: Math.max(100, Math.min(Math.max(100, wallLen - b.startMm), mm)) })} />
      <div className="flex flex-wrap gap-1.5">
        {HEIGHT_CHIPS.map(([lo, hi]) => (
          <button key={`${lo}-${hi}`} type="button" aria-pressed={b.bottomMm === lo && b.topMm === hi}
            className={chip(b.bottomMm === lo && b.topMm === hi)} onClick={() => onPatch({ bottomMm: lo, topMm: hi })}>
            {lo / 10}–{hi / 10} sm
          </button>
        ))}
      </div>
      <CmField label={t("studio.backsplash.bottom")} mm={b.bottomMm}
        onCommit={(mm) => onPatch({ bottomMm: Math.min(mm, b.topMm - 100) })} />
      <CmField label={t("studio.backsplash.top")} mm={b.topMm}
        onCommit={(mm) => onPatch({ topMm: Math.min(ceilingMm, Math.max(mm, b.bottomMm + 100)) })} />
      <div className="flex flex-wrap gap-1.5">
        {colors.map((color) => {
          const on = b.color.toLowerCase() === color.toLowerCase();
          return (
            <button key={color} type="button" aria-label={wallColorName(color)} aria-pressed={on} onClick={() => onPatch({ color })}
              className={`h-6 w-6 rounded-full border ${on ? "ring-2 ring-brand ring-offset-1 ring-offset-card" : "border-line"}`}
              style={{ background: color }} />
          );
        })}
      </div>
      <button type="button" onClick={onRemove} className="text-[12px] font-medium text-red-600 hover:underline">
        {t("studio.backsplash.remove")}
      </button>
    </div>
  );
}
