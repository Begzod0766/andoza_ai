import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import * as THREE from "three";
import { Html } from "@react-three/drei";
import { useRoomStore } from "@/store/roomStore";
import type { TowelRailSize } from "@/store/types";
import { isElectricRail, RAIL_SIZES, railSize } from "@/lib/towelRail";
import { DISHWASHER_WIDTHS, isDishwasher, isKitchenSink, machineSize } from "@/lib/washer";
import { formatDecimal } from "@/lib/utils";
import { useFixtureSelection, type FixtureSel } from "@/features/studio/fixtureSelection";
import { noRaycast } from "./constants";

type Rooms = ReturnType<typeof useRoomStore.getState>;

/**
 * A rail's or machine's name, numbered among its own kind when there are two, as the panel lists them
 * («Sochiq quritgich 2»). Null for one that is gone.
 */
export function fixtureName(sel: FixtureSel, s: Pick<Rooms, "towelRails" | "washers">, t: TFunction): string | null {
  const numbered = (label: string, i: number, n: number) => (n > 1 ? `${label} ${i + 1}` : label);
  if (sel.kind === "rail") {
    const i = s.towelRails.findIndex((r) => r.id === sel.id);
    return i < 0 ? null : numbered(t("studio.santexnika.rail"), i, s.towelRails.length);
  }
  const m = s.washers.find((w) => w.id === sel.id);
  if (!m) return null;
  const [same, label] = isKitchenSink(m) ? [s.washers.filter(isKitchenSink), t("studio.santexnika.sink")]
    : isDishwasher(m) ? [s.washers.filter(isDishwasher), t("studio.santexnika.dish")]
      : [s.washers.filter((w) => !isDishwasher(w) && !isKitchenSink(w)), t("studio.santexnika.washer")];
  return numbered(label, same.indexOf(m), same.length);
}

/** What the hold-to-delete menu names and does for a rail or machine (as for furniture). */
export function fixtureHoldItem(sel: FixtureSel, t: TFunction): { label: string; onDelete: () => void } {
  const s = useRoomStore.getState();
  return {
    label: fixtureName(sel, s, t) ?? "",
    onDelete: () => {
      const now = useRoomStore.getState();
      if (sel.kind === "rail") now.removeTowelRail(sel.id);
      else now.removeWasher(sel.id);
      const picked = useFixtureSelection.getState();
      if (picked.sel?.id === sel.id) picked.select(null);
    },
  };
}

const pill = (on: boolean) =>
  `h-9 rounded-full border px-3 text-[12px] font-medium ${on ? "border-[#2E5BFF] bg-[#2E5BFF] text-white" : "border-black/15 text-[#111827]"}`;
const pick = "h-9 rounded-full border border-black/15 bg-white px-2 text-[12px] text-[#111827]";

/**
 * The card's content: the name, the machine's size, and the piece's own controls (PR2, 2026-11-24): a rail
 * is heated by water or electric and has a size, a dishwasher a width. These were rows in the fixtures panel.
 */
export function FixtureCardBody({ sel }: { sel: FixtureSel }) {
  const { t } = useTranslation();
  const rail = useRoomStore((s) => (sel.kind === "rail" ? s.towelRails.find((r) => r.id === sel.id) : undefined));
  const machine = useRoomStore((s) => (sel.kind === "machine" ? s.washers.find((w) => w.id === sel.id) : undefined));
  const name = useRoomStore((s) => fixtureName(sel, s, t));
  const setKind = useRoomStore((s) => s.setTowelRailKind);
  const setSize = useRoomStore((s) => s.setTowelRailSize);
  const setWidth = useRoomStore((s) => s.setWasherWidth);
  /** The last size or width picked did not fit where the piece stands. */
  const [noRoom, setNoRoom] = useState(false);
  if (!name || (!rail && !machine)) return null;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#111827" }}>{name}</p>
      {machine && (() => {
        const { w, d } = machineSize(machine);
        return <p style={{ margin: 0, fontSize: 11, color: "#6B7280" }}>{formatDecimal(w / 1000, 2)} × {formatDecimal(d / 1000, 2)} m</p>;
      })()}
      {rail && (
        <div className="flex flex-wrap items-center justify-center gap-1">
          {(["water", "electric"] as const).map((k) => {
            const on = (isElectricRail(rail) ? "electric" : "water") === k;
            return (
              <button key={k} type="button" aria-pressed={on} onClick={() => !on && setKind(rail.id, k)} className={pill(on)}>
                {t(k === "water" ? "studio.santexnika.rail_water" : "studio.santexnika.rail_electric")}
              </button>
            );
          })}
          <select aria-label={t("studio.santexnika.rail_size")} value={rail.size ?? "500x800"} className={pick}
            onChange={(e) => setNoRoom(!setSize(rail.id, e.target.value as TowelRailSize))}>
            {RAIL_SIZES.map((sz) => {
              const { w, h } = railSize({ ...rail, size: sz });
              return <option key={sz} value={sz}>{t("studio.santexnika.rail_size_option", { w: w / 10, h: h / 10 })}</option>;
            })}
          </select>
        </div>
      )}
      {machine && isDishwasher(machine) && (
        <select aria-label={t("studio.santexnika.dish_width")} value={machineSize(machine).w} className={pick}
          onChange={(e) => setNoRoom(!setWidth(machine.id, Number(e.target.value) as 600 | 450))}>
          {DISHWASHER_WIDTHS.map((w) => <option key={w} value={w}>{t("studio.santexnika.dish_width_option", { cm: w / 10 })}</option>)}
        </select>
      )}
      {noRoom && (
        <p role="alert" style={{ margin: 0, fontSize: 11, color: "#EF4444", whiteSpace: "normal", maxWidth: 200 }}>
          {t(rail ? "studio.santexnika.rail_size_no_room" : "studio.santexnika.dish_width_no_room")}
        </p>
      )}
    </div>
  );
}

/** The card over a selected rail or machine, `y` metres above its centre, as furniture's own card floats. */
export function FixtureCard3D({ sel, y }: { sel: FixtureSel; y: number }) {
  return (
    <Html position={[0, y, 0]} center zIndexRange={[110, 0]} style={{ pointerEvents: "none" }}>
      <div
        // The hold-to-delete menu keeps off this card, as off furniture's (QA re-check R14).
        data-hold-avoid=""
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          pointerEvents: "all", background: "white", borderRadius: 12, padding: "10px 12px", minWidth: 150,
          boxShadow: "0 6px 20px rgba(0,0,0,.18)", whiteSpace: "nowrap", textAlign: "center",
        }}
      >
        <FixtureCardBody sel={sel} />
      </div>
    </Html>
  );
}

/** The selection line's colour and width, metres: furniture's (SelectionOutline). */
const OUTLINE = "#2563EB";
export const OUTLINE_M = 0.012;

/** A blue line round a box (a machine), drawn as furniture's is: the box pushed out, its back faces only. */
export function BoxOutline({ w, h, d, y = 0 }: { w: number; h: number; d: number; y?: number }) {
  return (
    <mesh position={[0, y, 0]} raycast={noRaycast}>
      <boxGeometry args={[w + 2 * OUTLINE_M, h + 2 * OUTLINE_M, d + 2 * OUTLINE_M]} />
      <meshBasicMaterial color={OUTLINE} side={THREE.BackSide} />
    </mesh>
  );
}

/** The same line round a rail's bar. */
export function BarOutline({ x, y, r, length, vertical }: { x: number; y: number; r: number; length: number; vertical: boolean }) {
  return (
    <mesh position={[x, y, 0]} rotation={vertical ? [0, 0, 0] : [0, 0, Math.PI / 2]} raycast={noRaycast}>
      <cylinderGeometry args={[r + OUTLINE_M, r + OUTLINE_M, length + 2 * OUTLINE_M, 12]} />
      <meshBasicMaterial color={OUTLINE} side={THREE.BackSide} />
    </mesh>
  );
}
