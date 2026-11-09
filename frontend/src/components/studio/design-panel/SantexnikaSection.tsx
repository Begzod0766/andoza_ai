import { useEffect, useState } from "react";
import { nanoid } from "nanoid";
import { useTranslation } from "react-i18next";
import { useRoomStore } from "@/store/roomStore";
import type { PlumbingKind, PlumbingPoint } from "@/store/roomStore";
import { inferRole, ROLE_GROUP } from "@/lib/furnitureRole";
import { plumbingSummary, riserSpot } from "@/lib/plumbingRuns";
import { wallNumber } from "@/lib/wallLabel";
import { formatDecimal } from "@/lib/utils";

const KINDS: PlumbingKind[] = ["drain", "cold", "hot"];

/**
 * "Santexnika" stage (spec 2026-11-08): the room's fixtures, their drain and water points and any
 * added by hand, a form to add one, and the pipe runs summed up. Shown in a bathroom or kitchen only.
 */
export function SantexnikaSection() {
  const { t } = useTranslation();
  const furniture = useRoomStore((s) => s.furniture);
  const catalog = useRoomStore((s) => s.catalogFurniture);
  const plumbing = useRoomStore((s) => s.plumbing);
  const geometry = useRoomStore((s) => s.geometry);
  const addPlumbing = useRoomStore((s) => s.addPlumbing);
  const removePlumbing = useRoomStore((s) => s.removePlumbing);
  const showPipeRuns = useRoomStore((s) => s.showPipeRuns);
  const setShowPipeRuns = useRoomStore((s) => s.setShowPipeRuns);
  // The runs are drawn for this stage only: leaving it puts them away.
  useEffect(() => () => setShowPipeRuns(false), [setShowPipeRuns]);
  const [kind, setKind] = useState<PlumbingKind>("drain");
  const [wallId, setWallId] = useState(geometry.walls[0]?.id ?? "A");
  const [heightCm, setHeightCm] = useState("50");

  const byId = new Map(catalog.map((c) => [c.id, c]));
  const fixtures = furniture.flatMap((f) => {
    const row = byId.get(f.furniture_id);
    const name = row?.name_uz ?? f.name ?? f.furniture_id;
    return ROLE_GROUP[inferRole(row?.category ?? null, name)] === "plumbing" ? [{ id: f.id, name }] : [];
  });
  const sum = plumbingSummary(geometry, plumbing, riserSpot(geometry));
  const where = (p: PlumbingPoint) => t("studio.santexnika.where", { wall: wallNumber(p.wallId), cm: Math.round(p.heightMm / 10) });

  function add() {
    const wall = geometry.walls.find((w) => w.id === wallId);
    const cm = Number(heightCm.replace(",", "."));
    addPlumbing({
      id: nanoid(), kind, wallId, heightMm: Number.isFinite(cm) ? Math.max(0, Math.round(cm * 10)) : 0,
      positionMm: Math.round((wall?.length ?? 0) / 2), diameterMm: kind === "drain" ? 50 : 20,
    });
  }

  const field = "w-full rounded-lg border border-line bg-card px-2 py-1.5 text-[12px] text-ink";
  return (
    <section className="space-y-4">
      <div>
        <h3 className="mb-1 text-sm font-semibold text-ink">{t("studio.santexnika.title")}</h3>
        <p className="text-[11px] leading-snug text-ink-muted">{t("studio.santexnika.hint")}</p>
      </div>

      <div>
        <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-ink-muted">{t("studio.santexnika.fixtures")}</span>
        {fixtures.length === 0
          ? <p className="text-[11px] text-ink-muted">{t("studio.santexnika.no_fixtures")}</p>
          : <ul className="flex flex-wrap gap-1.5">{fixtures.map((f) => <li key={f.id} className="rounded-full border border-line px-2.5 py-1 text-[11px] text-ink">{f.name}</li>)}</ul>}
      </div>

      <div>
        <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-ink-muted">{t("studio.santexnika.points")}</span>
        <ul className="space-y-1">
          {plumbing.map((p) => (
            <li key={p.id} aria-label={`${t(`studio.santexnika.${p.kind}`)}, ${where(p)}`}
              className="flex items-center justify-between gap-2 rounded-lg border border-line bg-card px-3 py-2">
              <span className="flex items-center gap-2 text-[12px] text-ink">
                <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ background: p.kind === "drain" ? "#9CA3AF" : p.kind === "cold" ? "#3B82F6" : "#EF4444" }} />
                {t(`studio.santexnika.${p.kind}`)} · {where(p)}
                {p.fixtureId && <span className="text-[10px] text-ink-muted">({t("studio.santexnika.own")})</span>}
              </span>
              {!p.fixtureId && (
                <button type="button" onClick={() => removePlumbing(p.id)} className="text-[11px] font-medium text-red-500 hover:text-red-600">
                  {t("studio.santexnika.remove")}
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <label className="text-[10px] text-ink-muted">{t("studio.santexnika.kind")}
          <select aria-label={t("studio.santexnika.kind")} value={kind} onChange={(e) => setKind(e.target.value as PlumbingKind)} className={field}>
            {KINDS.map((k) => <option key={k} value={k}>{t(`studio.santexnika.${k}`)}</option>)}
          </select>
        </label>
        <label className="text-[10px] text-ink-muted">{t("studio.santexnika.wall")}
          <select aria-label={t("studio.santexnika.wall")} value={wallId} onChange={(e) => setWallId(e.target.value)} className={field}>
            {geometry.walls.map((w) => <option key={w.id} value={w.id}>{wallNumber(w.id)}</option>)}
          </select>
        </label>
        <label className="text-[10px] text-ink-muted">{t("studio.santexnika.height")}
          <input aria-label={t("studio.santexnika.height")} inputMode="decimal" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} className={field} />
        </label>
      </div>
      <button type="button" onClick={add} className="w-full rounded-full border border-line py-2 text-[12px] font-semibold text-ink hover:border-brand/50 hover:text-accent">
        {t("studio.santexnika.add")}
      </button>

      <label className="flex items-center gap-2 text-[12px] text-ink">
        <input type="checkbox" checked={showPipeRuns} onChange={(e) => setShowPipeRuns(e.target.checked)} />
        {t("studio.santexnika.pipes")}
      </label>

      <p className="text-[11px] font-medium text-ink">
        {t("studio.santexnika.summary", { dp: sum.drain.points, dm: formatDecimal(sum.drain.m, 1), wp: sum.water.points, wm: formatDecimal(sum.water.m, 1) })}
      </p>
    </section>
  );
}
