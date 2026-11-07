import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import type { TKey } from "@/i18n";
import { newFreePart } from "@/features/mebel/engine";
import type { Band, FreePartSpec, FurnitureProject, Warning } from "@/features/mebel/engine";
import { Chevron, NumField, Select, field, summary } from "./fields";
import { formatBand } from "./format";

type Update = (fn: (p: FurnitureProject) => FurnitureProject) => void

/** The field each free-part error belongs to. */
export const FREE_ERROR_FIELD: Record<string, "size" | "qty" | "name"> = { free_size: "size", free_qty: "qty", free_name: "name" };
const NEXT_BAND: Record<string, Band> = { none: "visible", visible: "hidden", hidden: null };

/**
 * Parts entered by hand, belonging to no cabinet: one line each, opened to
 * edit, the same way the cabinets are. They are cut, banded and priced like
 * cabinet parts; they have no holes and no place in the 3D view.
 */
export function FreePartsPanel({ project, update, errors }: { project: FurnitureProject; update: Update; errors: Warning[] }) {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const parts = project.freeParts ?? [];
  const [openId, setOpenId] = useState<string | null>(null);
  const d = project.defaults;

  const nextLabel = () => `D${Math.max(0, ...parts.map((f) => Number(f.label.replace(/\D/g, "")) || 0)) + 1}`;
  const setPart = (id: string, patch: Partial<FreePartSpec>) =>
    update((p) => ({ ...p, freeParts: (p.freeParts ?? []).map((f) => (f.id === id ? { ...f, ...patch } : f)) }));
  const add = (from?: FreePartSpec) => {
    const part = from ? { ...structuredClone(from), id: crypto.randomUUID(), label: nextLabel() } : newFreePart(nextLabel());
    setOpenId(part.id);
    update((p) => ({ ...p, freeParts: [...(p.freeParts ?? []), part] }));
  };
  const remove = async (f: FreePartSpec) => {
    if (!(await confirm({ title: t("mebel.free.remove_confirm", { label: f.label }), destructive: true, confirmLabel: t("mebel.remove") }))) return;
    update((p) => ({ ...p, freeParts: (p.freeParts ?? []).filter((x) => x.id !== f.id) }));
  };
  const errorFor = (id: string, key: "size" | "qty" | "name") => {
    const e = errors.find((x) => x.cabinetId === id && FREE_ERROR_FIELD[x.code] === key);
    return e ? t(`mebel.error.${e.code}` as TKey, e.params) : undefined;
  };
  const bandThickness = (b: Band) => (b == null ? 0 : d.edge[b].thickness);

  return (
    <details data-testid="section-free" open className="group/free flex flex-col gap-2">
      <summary className={`${summary} py-2`}>
        {t("mebel.free.title")}
        <button type="button" onClick={(e) => { e.preventDefault(); add(); }}
          className="ml-auto mr-2 rounded-full bg-accent/15 px-2.5 py-1.5 text-xs font-semibold text-accent hover:bg-accent/25">
          {t("mebel.free.add")}
        </button>
      </summary>
      <div className="flex flex-col gap-2">
        {parts.length === 0 && <p className="text-xs text-ink-muted">{t("mebel.free.empty")}</p>}
        {parts.map((f) => {
          const hasError = errors.some((e) => e.cabinetId === f.id);
          const open = openId === f.id || hasError;
          const sizeError = errorFor(f.id, "size");
          return (
            <details key={f.id} data-testid={`free-${f.label}`} open={open}
              className={`group rounded-2xl border ${open ? "border-accent/40 bg-accent/10" : "border-line"}`}>
              <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-sm"
                onClick={(e) => { e.preventDefault(); setOpenId(openId === f.id ? null : f.id); }}>
                {hasError && <span data-testid="free-error-dot" className="h-2 w-2 shrink-0 rounded-full bg-red-500" />}
                <span className="font-bold text-ink">{f.label}</span>
                <span className="min-w-0 truncate text-ink-muted">· {f.name}</span>
                <span className="ml-auto shrink-0 tabular-nums text-xs text-ink-muted">
                  {`${f.length}×${f.width} · ${t("mebel.free.pieces", { n: f.qty })}`}
                </span>
                <Chevron />
              </summary>
              <div className="grid grid-cols-2 gap-3 px-3 pb-3">
                <div className="col-span-2 flex flex-col gap-1">
                  <label htmlFor={`${f.id}-name`} className="text-xs text-ink-muted">{t("mebel.free.name")}</label>
                  <input id={`${f.id}-name`} value={f.name} maxLength={60} className={field}
                    onChange={(e) => setPart(f.id, { name: e.target.value })} />
                  {errorFor(f.id, "name") && <p className="text-xs text-red-500">{errorFor(f.id, "name")}</p>}
                </div>
                <NumField id={`${f.id}-len`} label={t("mebel.free.length")} value={f.length}
                  error={sizeError && !(f.length >= 10 && f.length <= 3000 && Number.isInteger(f.length)) ? sizeError : undefined}
                  onChange={(v) => setPart(f.id, { length: v })} />
                <NumField id={`${f.id}-wid`} label={t("mebel.free.width")} value={f.width}
                  error={sizeError && !(f.width >= 10 && f.width <= 3000 && Number.isInteger(f.width)) ? sizeError : undefined}
                  onChange={(v) => setPart(f.id, { width: v })} />
                <NumField id={`${f.id}-qty`} label={t("mebel.free.qty")} value={f.qty} error={errorFor(f.id, "qty")}
                  onChange={(v) => setPart(f.id, { qty: v })} />
                <Select id={`${f.id}-mat`} label={t("mebel.free.material")} value={f.material}
                  options={(["board", "back", "facade"] as const).map((v) => ({ value: v, label: t(`mebel.free.materials.${v}`) }))}
                  onChange={(v) => setPart(f.id, { material: v })} />
                <Select id={`${f.id}-grain`} label={t("mebel.free.grain")} value={f.grain}
                  options={(["length", "none"] as const).map((v) => ({ value: v, label: t(`mebel.grain.${v}`) }))}
                  onChange={(v) => setPart(f.id, { grain: v })} />
                <div className="col-span-2 flex flex-col gap-1">
                  <span className="text-xs text-ink-muted">{t("mebel.free.edges")}</span>
                  <div className="grid grid-cols-4 gap-1">
                    {(["L1", "L2", "W1", "W2"] as const).map((side) => {
                      const b = f.edges[side];
                      return (
                        <button key={side} type="button" aria-pressed={b != null}
                          onClick={() => setPart(f.id, { edges: { ...f.edges, [side]: NEXT_BAND[b ?? "none"] } })}
                          className={`rounded-lg px-2 py-1.5 text-xs font-semibold tabular-nums ${b ? "bg-blue-600 text-white" : "bg-card-soft text-ink-muted"}`}>
                          {`${side} ${formatBand(bandThickness(b))}`}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 px-3 pb-3">
                <button type="button" onClick={() => add(f)} className="text-xs font-semibold text-ink-muted hover:text-ink">
                  {t("mebel.duplicate")}
                </button>
                {/* a project with no cabinet keeps at least one part */}
                {(project.cabinets.length > 0 || parts.length > 1) && (
                  <button type="button" onClick={() => void remove(f)} className="text-xs font-semibold text-red-500">
                    {t("mebel.remove")}
                  </button>
                )}
              </div>
            </details>
          );
        })}
      </div>
    </details>
  );
}
