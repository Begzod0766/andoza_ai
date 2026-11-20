import { useTranslation } from "react-i18next";
import { useRoomStore } from "@/store/roomStore";
import { useRoomKind, useRoomStages } from "@/features/studio/useStageView";
import { furnitureStage, hiddenAt, type HiddenKind } from "@/lib/stageView";

/**
 * Over the 3D while it draws a stage, not the finished room (spec 2026-11-18): what this stage does
 * not have yet, and a tap back to the finished room. Shown only when something the room has is
 * actually hidden, so nobody wonders where their things went.
 */
export function StageBanner() {
  const { t } = useTranslation();
  const view = useRoomStore((s) => s.viewStage);
  const setViewStage = useRoomStore((s) => s.setViewStage);
  const furniture = useRoomStore((s) => s.furniture);
  const catalog = useRoomStore((s) => s.catalogFurniture);
  const electricals = useRoomStore((s) => s.electricals.length);
  const lights = useRoomStore((s) => s.lights.length);
  const railsAndMachines = useRoomStore((s) => s.towelRails.length + s.washers.length);
  const roomKind = useRoomKind();
  const stages = useRoomStages();
  if (view === "full") return null;

  const byId = new Map(catalog.map((c) => [c.id, c]));
  const fixtures = furniture.filter((f) => {
    const row = byId.get(f.furniture_id);
    return furnitureStage(row?.name_uz ?? f.name ?? f.furniture_id, row?.category, roomKind) === "jihozlar";
  }).length;
  const hidden = hiddenAt(view, stages, {
    electricals,
    fixtures: fixtures + railsAndMachines,
    lights,
    furniture: furniture.length - fixtures,
  });
  if (hidden.length === 0) return null;
  const names = hidden.map((k: HiddenKind) => t(`studio.stage_view.${k}`)).join(", ");
  return (
    <div role="status" className="pointer-events-auto flex items-center gap-2 rounded-full border border-line bg-card/95 py-1.5 pl-3 pr-1.5 text-[12px] text-ink shadow-md backdrop-blur">
      <span>{t("studio.stage_view.hidden", { things: names })}</span>
      <button type="button" onClick={() => setViewStage("full")}
        className="shrink-0 rounded-full bg-brand px-3 py-1 text-[11px] font-semibold text-white hover:opacity-90">
        {t("studio.stage_view.show_full")}
      </button>
    </div>
  );
}
