import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Button } from "@/components/ui/Button";
import { addOffcut, deleteOffcut, errorMessage, getCatalogMaterials, listMebelProjects, listOffcuts } from "@/lib/api";
import type { Material, MebelOffcut, OffcutIn } from "@/lib/api";
import type { TKey } from "@/i18n";

const field = "w-full rounded-xl border border-line bg-card px-3 py-2 text-sm text-ink";
const MATERIALS = ["board", "back", "facade"] as const;
/** The thicknesses a board of each kind comes in: a stock piece matches its board exactly. */
const THICKNESS = { board: [16, 18], back: [3, 4], facade: [16, 18, 19] } as const;
/** A catalogue item as the project page names it: "name · store". */
const itemName = (m: Material) => (m.store_name ? `${m.name_uz} · ${m.store_name}` : m.name_uz);

/**
 * The workshop's offcut store: pieces of board kept for the next jobs, by
 * material and thickness. Pieces arrive from a job's "Kesildi" or by hand
 * here, and leave on the "Kesildi" of the job that cut from them.
 */
export default function MebelOffcutsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const offcuts = useQuery({ queryKey: ["mebel", "offcuts"], queryFn: listOffcuts });
  const projects = useQuery({ queryKey: ["mebel", "projects"], queryFn: listMebelProjects });
  const ldsp = useQuery({ queryKey: ["mebel", "catalog", "ldsp"], queryFn: () => getCatalogMaterials("ldsp"), staleTime: 10 * 60_000 });
  const hdf = useQuery({ queryKey: ["mebel", "catalog", "hdf"], queryFn: () => getCatalogMaterials("hdf"), staleTime: 10 * 60_000 });
  const [draft, setDraft] = useState<OffcutIn>({ material: "board", materialId: null, thickness: 18, length: 0, width: 0 });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["mebel", "offcuts"] });

  const add = useMutation({ mutationFn: (body: OffcutIn) => addOffcut(body), onSuccess: () => { refresh(); setDraft((d) => ({ ...d, length: 0, width: 0 })); } });
  const remove = useMutation({ mutationFn: (id: string) => deleteOffcut(id), onSuccess: refresh });

  const catalogFor = (m: OffcutIn["material"]) => (m === "back" ? hdf.data : ldsp.data) ?? [];
  const nameOf = (o: MebelOffcut) => (() => { const m = catalogFor(o.material).find((x) => x.id === o.materialId); return m ? itemName(m) : t("mebel.no_material"); })();
  const sourceOf = (o: MebelOffcut) => projects.data?.find((p) => p.id === o.source_project_id)?.name ?? t("mebel.offcuts.by_hand");
  const groups = new Map<string, MebelOffcut[]>();
  for (const o of offcuts.data ?? []) {
    const key = `${o.material}|${o.thickness}`;
    groups.set(key, [...(groups.get(key) ?? []), o]);
  }
  const side = (v: number) => Number.isInteger(v) && v >= 200 && v <= 5000;
  const valid = side(draft.length) && side(draft.width) && (THICKNESS[draft.material] as readonly number[]).includes(draft.thickness);

  async function onDelete(o: MebelOffcut) {
    if (!(await confirm({ title: t("mebel.offcuts.delete_confirm", { l: o.length, w: o.width }), destructive: true, confirmLabel: t("mebel.delete") }))) return;
    remove.mutate(o.id);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Link to="/mebel" className="text-sm font-semibold text-brand-light">← {t("mebel.back_to_list")}</Link>
      <h1 className="mt-2 text-2xl font-bold text-ink">{t("mebel.offcuts.title")}</h1>
      <p className="mt-1 text-sm text-ink-muted">{t("mebel.offcuts.subtitle")}</p>

      <section className="mt-6 rounded-2xl bg-card p-4 ring-1 ring-line">
        <h2 className="text-sm font-bold text-ink">{t("mebel.offcuts.add_title")}</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <label className="flex flex-col gap-1 text-xs text-ink-muted">
            {t("mebel.free.material")}
            <select className={field} value={draft.material}
              onChange={(e) => setDraft((d) => ({ ...d, material: e.target.value as OffcutIn["material"], materialId: null, thickness: e.target.value === "back" ? 4 : 18 }))}>
              {MATERIALS.map((m) => <option key={m} value={m}>{t(`mebel.free.materials.${m}`)}</option>)}
            </select>
          </label>
          <label className="col-span-2 flex flex-col gap-1 text-xs text-ink-muted sm:col-span-1">
            {t("mebel.board_material")}
            <select className={field} value={draft.materialId ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, materialId: e.target.value || null }))}>
              <option value="">{t("mebel.no_material")}</option>
              {catalogFor(draft.material).map((m) => <option key={m.id} value={m.id}>{itemName(m)}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-ink-muted">
            {t("mebel.offcuts.thickness")}
            <select className={field} value={draft.thickness}
              onChange={(e) => setDraft((d) => ({ ...d, thickness: Number(e.target.value) }))}>
              {[...new Set([...THICKNESS.board, ...THICKNESS.facade])].filter((v) => (THICKNESS[draft.material] as readonly number[]).includes(v)).map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </label>
          {/* a stock piece is never turned: its length runs with the grain */}
          {([["length", "mebel.offcuts.length_grain"], ["width", "mebel.free.width"]] as const).map(([k, label]) => (
            <label key={k} className="flex flex-col gap-1 text-xs text-ink-muted">
              {t(label)}
              <input type="number" inputMode="numeric" step={1} className={field} value={draft[k] || ""}
                onChange={(e) => setDraft((d) => ({ ...d, [k]: Number(e.target.value) || 0 }))} />
            </label>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-3">
          <Button onClick={() => add.mutate(draft)} loading={add.isPending} disabled={!valid}>{t("mebel.offcuts.add")}</Button>
          <span className="text-xs text-ink-muted">{t("mebel.offcuts.size_hint")}</span>
          {add.isError && <span role="alert" className="text-xs text-red-500">{errorMessage(add.error)}</span>}
        </div>
      </section>

      <div className="mt-6 flex flex-col gap-4">
        {offcuts.isLoading ? (
          <div className="h-24 animate-pulse rounded-2xl bg-card-soft" />
        ) : groups.size === 0 ? (
          <p className="rounded-2xl bg-card p-6 text-center text-sm text-ink-muted">{t("mebel.offcuts.empty")}</p>
        ) : (
          [...groups.entries()].map(([key, list]) => {
            const [m, thickness] = key.split("|");
            return (
              <section key={key} className="rounded-2xl bg-card p-4 ring-1 ring-line">
                <h2 className="text-sm font-bold text-ink">{t("mebel.offcuts.group", { m: t(`mebel.material.${m}` as TKey), t: thickness })}</h2>
                <ul className="mt-2 flex flex-col">
                  {list.map((o) => (
                    <li key={o.id} className="flex items-center gap-3 border-t border-line py-2 text-sm first:border-t-0">
                      <span className="font-semibold tabular-nums text-ink">{`${o.length} × ${o.width}`}</span>
                      <span className="min-w-0 flex-1 truncate text-ink-muted">{`${nameOf(o)} · ${sourceOf(o)}`}</span>
                      <button type="button" onClick={() => void onDelete(o)}
                        className="rounded-full px-3 py-1 text-xs font-semibold text-red-500 hover:bg-red-500/10">
                        {t("mebel.delete")}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
