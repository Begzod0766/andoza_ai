import { useState } from "react";
import { nanoid } from "nanoid";
import { useTranslation } from "react-i18next";
import { useRoomStore } from "@/store/roomStore";
import type { PlumbingKind, PlumbingPoint } from "@/store/roomStore";
import { inferRole, ROLE_GROUP } from "@/lib/furnitureRole";
import { plumbingSummary, roomRiser } from "@/lib/plumbingRuns";
import { withRailPoints } from "@/lib/towelRail";
import { withWasherPoints } from "@/lib/washer";
import { wallNumber } from "@/lib/wallLabel";
import { formatDecimal } from "@/lib/utils";
import { fixtureDisplayName } from "@/lib/fixtureName";
import { PIPE_COLOUR } from "@/lib/pipeScheme";

const KINDS: PlumbingKind[] = ["drain", "cold", "hot"];

/**
 * "Santexnika" stage (spec 2026-11-08): the room's fixtures, their drain and water points and any
 * added by hand, a form to add one, and the pipe runs summed up. Shown in a bathroom or kitchen only.
 */
export function SantexnikaSection({ bathroom = false }: {
  /** The room is a bathroom: the towel rail and the extractor fan are offered (spec 2026-11-10). */
  bathroom?: boolean;
}) {
  const { t } = useTranslation();
  const ventFan = useRoomStore((s) => s.designState.ventFan);
  const plumbingDemolition = useRoomStore((s) => s.designState.plumbingDemolition);
  const pipesInWall = useRoomStore((s) => s.designState.pipesInWall);
  const waterHeater = useRoomStore((s) => s.designState.waterHeater);
  const floorDrain = useRoomStore((s) => s.designState.floorDrain);
  const setDesignState = useRoomStore((s) => s.setDesignState);
  const towelRails = useRoomStore((s) => s.towelRails);
  const addTowelRail = useRoomStore((s) => s.addTowelRail);
  const removeTowelRail = useRoomStore((s) => s.removeTowelRail);
  const washers = useRoomStore((s) => s.washers);
  const addWasher = useRoomStore((s) => s.addWasher);
  const removeWasher = useRoomStore((s) => s.removeWasher);
  /** The last "add a washing machine" found no place for one. */
  const [noWasherRoom, setNoWasherRoom] = useState(false);
  /** The last "add a rail" found no wall with room for one. */
  const [noRailRoom, setNoRailRoom] = useState(false);
  const furniture = useRoomStore((s) => s.furniture);
  const catalog = useRoomStore((s) => s.catalogFurniture);
  const plumbing = useRoomStore((s) => s.plumbing);
  const geometry = useRoomStore((s) => s.geometry);
  const addPlumbing = useRoomStore((s) => s.addPlumbing);
  const removePlumbing = useRoomStore((s) => s.removePlumbing);
  const plumbingRiser = useRoomStore((s) => s.plumbingRiser);
  const setPlumbingRiser = useRoomStore((s) => s.setPlumbingRiser);
  /** The distance being typed, until it is committed (blur or Enter); null shows the riser's own. */
  const [riserDraft, setRiserDraft] = useState<string | null>(null);
  const showPipeRuns = useRoomStore((s) => s.showPipeRuns);
  const setShowPipeRuns = useRoomStore((s) => s.setShowPipeRuns);
  // The runs stay drawn until the box is unticked, also after the panel closes: on a phone the open
  // panel covers half the 3D (mobile QA 2026-11-09 #3, the user's call).
  const [kind, setKind] = useState<PlumbingKind>("drain");
  const [wallId, setWallId] = useState(geometry.walls[0]?.id ?? "A");
  const [heightCm, setHeightCm] = useState("50");

  const byId = new Map(catalog.map((c) => [c.id, c]));
  // A floor drain is offered only with a shower in the room (spec 2026-11-13).
  const hasShower = furniture.some((f) => {
    const row = byId.get(f.furniture_id);
    return inferRole(row?.category ?? null, row?.name_uz ?? f.name ?? f.furniture_id) === "shower";
  });
  const fixtures = furniture.flatMap((f) => {
    const row = byId.get(f.furniture_id);
    const name = row?.name_uz ?? f.name ?? f.furniture_id;
    return ROLE_GROUP[inferRole(row?.category ?? null, name)] === "plumbing" ? [{ id: f.id, name: fixtureDisplayName(name, t) }] : [];
  });
  // A rail's two points are worked out from it, never saved: shown and summed with the rest.
  // A washing machine's two likewise (spec 2026-11-13).
  const points = withWasherPoints(withRailPoints(plumbing, towelRails, geometry), washers, geometry);
  const riser = roomRiser(geometry, plumbingRiser);
  const sum = plumbingSummary(geometry, points, riser);
  /** Sets the riser by hand, kept on its wall (roomRiser clamps it). */
  const placeRiser = (wallId: string, positionMm: number) =>
    setPlumbingRiser(roomRiser(geometry, { wallId, positionMm }));
  function commitRiserDraft() {
    if (riserDraft == null) return;
    const cm = Number(riserDraft.replace(",", "."));
    setRiserDraft(null);
    if (Number.isFinite(cm)) placeRiser(riser.wallId, Math.round(cm * 10));
  }
  const where = (p: PlumbingPoint) => t("studio.santexnika.where", { wall: wallNumber(p.wallId), cm: Math.round(p.heightMm / 10) });

  // The room's walls can change under an open panel (another room, a resize): the picker keeps to them.
  const pickedWall = geometry.walls.some((w) => w.id === wallId) ? wallId : (geometry.walls[0]?.id ?? "A");

  function add() {
    // Read the walls as they are now, not as they were when the panel last drew.
    const walls = useRoomStore.getState().geometry.walls;
    const target = walls.some((w) => w.id === wallId) ? wallId : (walls[0]?.id ?? "A");
    const wall = walls.find((w) => w.id === target);
    const cm = Number(heightCm.replace(",", "."));
    addPlumbing({
      id: nanoid(), kind, wallId: target, heightMm: Number.isFinite(cm) ? Math.max(0, Math.round(cm * 10)) : 0,
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
          {points.map((p) => (
            <li key={p.id} aria-label={`${t(`studio.santexnika.${p.kind}`)}, ${where(p)}`}
              className="flex items-center justify-between gap-2 rounded-lg border border-line bg-card px-3 py-2">
              <span className="flex items-center gap-2 text-[12px] text-ink">
                <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ background: PIPE_COLOUR[p.kind] }} />
                {t(`studio.santexnika.${p.kind}`)} · {where(p)}
                {p.fixtureId && <span className="text-[10px] text-ink-muted">({t("studio.santexnika.own")})</span>}
                {p.railId && <span className="text-[10px] text-ink-muted">({t("studio.santexnika.rail_own")})</span>}
                {p.washerId && <span className="text-[10px] text-ink-muted">({t("studio.santexnika.washer_own")})</span>}
              </span>
              {!p.fixtureId && !p.railId && !p.washerId && (
                <button type="button" onClick={() => removePlumbing(p.id)} className="text-[11px] font-medium text-red-500 hover:text-red-600">
                  {t("studio.santexnika.remove")}
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* The kind has a row to itself: in a third of the panel «Канализация» was cut short (mobile QA 2026-11-11 #7). */}
      <div className="grid grid-cols-2 gap-2">
        <label className="col-span-2 text-[10px] text-ink-muted">{t("studio.santexnika.kind")}
          <select aria-label={t("studio.santexnika.kind")} value={kind} onChange={(e) => setKind(e.target.value as PlumbingKind)} className={field}>
            {KINDS.map((k) => <option key={k} value={k}>{t(`studio.santexnika.${k}`)}</option>)}
          </select>
        </label>
        <label className="text-[10px] text-ink-muted">{t("studio.santexnika.wall")}
          <select aria-label={t("studio.santexnika.wall")} value={pickedWall} onChange={(e) => setWallId(e.target.value)} className={field}>
            {geometry.walls.map((w) => <option key={w.id} value={w.id}>{wallNumber(w.id)}</option>)}
          </select>
        </label>
        <label className="text-[10px] text-ink-muted">{t("studio.santexnika.height")}
          <input aria-label={t("studio.santexnika.height")} inputMode="decimal" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} className={field}
            // On a phone the keyboard came up over the field (mobile QA 2026-11-09 #4).
            onFocus={(e) => e.currentTarget.scrollIntoView?.({ block: "center", behavior: "smooth" })} />
        </label>
      </div>
      <button type="button" onClick={add} className="w-full rounded-full border border-line py-2 text-[12px] font-semibold text-ink hover:border-brand/50 hover:text-accent">
        {t("studio.santexnika.add")}
      </button>

      {/* Adding is for a bathroom; a rail already hung is listed, and can be removed, in any room. */}
      {(bathroom || towelRails.length > 0) && (
        <div className="space-y-1.5">
          <span className="block text-[10px] font-bold uppercase tracking-widest text-ink-muted">{t("studio.santexnika.rail")}</span>
          {towelRails.length > 0 && (
            <ul className="space-y-1">
              {towelRails.map((r) => (
                <li key={r.id} aria-label={`${t("studio.santexnika.rail")}, ${t("studio.santexnika.where", { wall: wallNumber(r.wallId), cm: Math.round(r.heightMm / 10) })}`}
                  className="flex items-center justify-between gap-2 rounded-lg border border-line bg-card px-3 py-2">
                  <span className="text-[12px] text-ink">{t("studio.santexnika.where", { wall: wallNumber(r.wallId), cm: Math.round(r.heightMm / 10) })}</span>
                  <button type="button" onClick={() => removeTowelRail(r.id)} className="text-[11px] font-medium text-red-500 hover:text-red-600">
                    {t("studio.santexnika.remove")}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {bathroom && (
            <button type="button" onClick={() => setNoRailRoom(!addTowelRail())}
              className="w-full rounded-full border border-line py-2 text-[12px] font-semibold text-ink hover:border-brand/50 hover:text-accent">
              {t("studio.santexnika.rail_add")}
            </button>
          )}
          {noRailRoom && <p role="alert" className="text-[11px] text-red-500">{t("studio.santexnika.rail_no_room")}</p>}
        </div>
      )}

      {/* A washing machine (spec 2026-11-13), in a bathroom or a kitchen: the panel shows only there. */}
      <div className="space-y-1.5">
        <span className="block text-[10px] font-bold uppercase tracking-widest text-ink-muted">{t("studio.santexnika.washer")}</span>
        {washers.length > 0 && (
          <ul className="space-y-1">
            {washers.map((m) => (
              <li key={m.id} aria-label={`${t("studio.santexnika.washer")}, ${t("studio.santexnika.washer_where", { wall: wallNumber(m.wallId) })}`}
                className="flex items-center justify-between gap-2 rounded-lg border border-line bg-card px-3 py-2">
                <span className="text-[12px] text-ink">{t("studio.santexnika.washer_where", { wall: wallNumber(m.wallId) })}</span>
                <button type="button" onClick={() => removeWasher(m.id)} className="text-[11px] font-medium text-red-500 hover:text-red-600">
                  {t("studio.santexnika.remove")}
                </button>
              </li>
            ))}
          </ul>
        )}
        <button type="button" onClick={() => setNoWasherRoom(!addWasher())}
          className="w-full rounded-full border border-line py-2 text-[12px] font-semibold text-ink hover:border-brand/50 hover:text-accent">
          {t("studio.santexnika.washer_add")}
        </button>
        {noWasherRoom && <p role="alert" className="text-[11px] text-red-500">{t("studio.santexnika.washer_no_room")}</p>}
      </div>

      {/* The riser the user moves (2026-11-13): the pipes start here. Also dragged along the walls in 3D. */}
      <div className="space-y-1.5">
        <span className="block text-[10px] font-bold uppercase tracking-widest text-ink-muted">{t("studio.santexnika.riser")}</span>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[10px] text-ink-muted">{t("studio.santexnika.riser_wall")}
            <select aria-label={t("studio.santexnika.riser_wall")} value={riser.wallId} className={field}
              onChange={(e) => placeRiser(e.target.value, riser.positionMm)}>
              {geometry.walls.map((w) => <option key={w.id} value={w.id}>{wallNumber(w.id)}</option>)}
            </select>
          </label>
          <label className="text-[10px] text-ink-muted">{t("studio.santexnika.riser_pos")}
            <input aria-label={t("studio.santexnika.riser_pos")} inputMode="decimal" className={field}
              value={riserDraft ?? String(Math.round(riser.positionMm / 10))}
              onChange={(e) => setRiserDraft(e.target.value)} onBlur={commitRiserDraft}
              onKeyDown={(e) => { if (e.key === "Enter") commitRiserDraft(); }}
              onFocus={(e) => e.currentTarget.scrollIntoView?.({ block: "center", behavior: "smooth" })} />
          </label>
        </div>
        <button type="button" disabled={!plumbingRiser} onClick={() => { setRiserDraft(null); setPlumbingRiser(null); }}
          className="w-full rounded-full border border-line py-2 text-[12px] font-semibold text-ink hover:border-brand/50 hover:text-accent disabled:opacity-50 disabled:hover:border-line disabled:hover:text-ink">
          {t("studio.santexnika.riser_auto")}
        </button>
        <p className="text-[10px] text-ink-muted">{t("studio.santexnika.riser_hint")}</p>
      </div>

      <label className="flex items-center gap-2 text-[12px] text-ink">
        <input type="checkbox" checked={showPipeRuns} onChange={(e) => setShowPipeRuns(e.target.checked)} />
        {t("studio.santexnika.pipes")}
      </label>

      {/* For the estimate (2026-11-13): the old plumbing taken out (off unless ticked), the walls
          chased for the pipes (on unless unticked). smeta.py reads exactly true / exactly false. */}
      <label className="flex items-center gap-2 text-[12px] text-ink">
        <input type="checkbox" checked={plumbingDemolition === true} onChange={(e) => setDesignState({ plumbingDemolition: e.target.checked })} />
        {t("studio.santexnika.demolition")}
      </label>
      <label className="flex items-center gap-2 text-[12px] text-ink">
        <input type="checkbox" checked={pipesInWall !== false} onChange={(e) => setDesignState({ pipesInWall: e.target.checked })} />
        {t("studio.santexnika.in_wall")}
      </label>
      {hasShower && (
        <label className="flex items-center gap-2 text-[12px] text-ink">
          {/* Off unless ticked: the estimate reads only an exact true (smeta.py _fixture_part_lines). */}
          <input type="checkbox" checked={floorDrain === true} onChange={(e) => setDesignState({ floorDrain: e.target.checked })} />
          {t("studio.santexnika.floor_drain")}
        </label>
      )}
      <label className="flex items-center gap-2 text-[12px] text-ink">
        {/* Off unless ticked: the estimate reads only an exact true (smeta.py _water_heater_lines). */}
        <input type="checkbox" checked={waterHeater === true} onChange={(e) => setDesignState({ waterHeater: e.target.checked })} />
        {t("studio.santexnika.water_heater")}
      </label>

      {bathroom && (
        <label className="flex items-center gap-2 text-[12px] text-ink">
          {/* On unless switched off: the estimate reads only an exact false (smeta.py _fan_lines). */}
          <input type="checkbox" checked={ventFan !== false} onChange={(e) => setDesignState({ ventFan: e.target.checked })} />
          {t("studio.santexnika.fan")}
        </label>
      )}

      <p className="text-[11px] font-medium text-ink">
        {t("studio.santexnika.summary", { dp: sum.drain.points, dm: formatDecimal(sum.drain.m, 1), wp: sum.water.points, wm: formatDecimal(sum.water.m, 1) })}
      </p>
    </section>
  );
}
