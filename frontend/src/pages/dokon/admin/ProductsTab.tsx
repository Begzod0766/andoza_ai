import { useEffect, useRef, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, ChevronDown, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import type { TKey } from "@/i18n";
import {
  MATERIAL_CATEGORIES, getAdminFurniture, getAdminMaterial, getProductsOverview, listAdminProducts, listAdminStores,
  updateAdminMaterial, type AdminFurniture, type AdminMaterial, type AdminProduct, type ProductFilters, type ProductKind,
} from "@/lib/api";
import { useDebounce } from "@/hooks/useDebounce";
import { cn } from "@/lib/utils";
import { Panel } from "@/components/ui/Panel";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { FilterChip } from "./FilterChip";
import { KindIcon, ProductRow } from "./ProductRow";
import { Pager } from "./Pager";
import { MaterialFormDialog } from "./MaterialFormDialog";
import { ModelEditDialog } from "./ModelEditDialog";
import { ModelFormDialog } from "./ModelFormDialog";
import { categoryLabel } from "./labels";
import { optionLabel } from "./materialLabels";
import { requestError, type FormError } from "@/lib/formError";

type KindFilter = ProductKind | "all";
type StatusFilter = "all" | "active" | "hidden";
type Category = { kind: ProductKind; id: string };

const PER_PAGE = 25;

const KINDS: Array<{ value: KindFilter; labelKey: TKey }> = [
  { value: "all", labelKey: "dokon.admin.products.kind_all" },
  { value: "materials", labelKey: "dokon.admin.products.kind_materials" },
  { value: "furniture", labelKey: "dokon.admin.products.kind_furniture" },
];
const STATUSES: Array<{ value: StatusFilter; labelKey: TKey }> = [
  { value: "all", labelKey: "dokon.admin.products.status_all" },
  { value: "active", labelKey: "dokon.admin.products.status_active" },
  { value: "hidden", labelKey: "dokon.admin.products.status_hidden" },
];

const sameCategory = (a: Category | null | undefined, b: Category | null) =>
  !!a && !!b && a.kind === b.kind && a.id === b.id;

const kindLabel = (kind: ProductKind, category: string, t: TFunction) =>
  kind === "materials" ? optionLabel(MATERIAL_CATEGORIES, category, t) : categoryLabel(category, t);

const field = "h-10 rounded-xl border border-line bg-card-soft text-sm text-ink focus:outline-none focus:ring-2 focus:ring-[#5B84F5]/70";

/** A labelled row of chips that picks one value. */
function ChipGroup<T extends string>({ label, options, value, onChange }: {
  label: string; options: Array<{ value: T; labelKey: TKey }>; value: T; onChange: (v: T) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-1.5" role="group" aria-label={label}>
      <span className="mr-0.5 text-xs font-semibold text-ink-muted" aria-hidden="true">{label}:</span>
      {options.map((o) => (
        <FilterChip key={o.value} pressed={value === o.value} onClick={() => onChange(o.value)}>{t(o.labelKey)}</FilterChip>
      ))}
    </div>
  );
}

/**
 * Every product in the shop catalogue, materials and 3D models together. With every category
 * showing, each category is a block of its first rows and a "Barchasini ko'rish" button; one
 * category lists its products a page at a time. The server filters and counts, so every number
 * on the page is exact.
 */
export function ProductsTab({ onError }: { onError: (message: FormError) => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<KindFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [storeId, setStoreId] = useState("");
  const [search, setSearch] = useState("");
  const q = useDebounce(search.trim(), 300);
  const [categorySearch, setCategorySearch] = useState("");
  const [category, setCategory] = useState<Category | null>(null);
  const [page, setPage] = useState(1);
  const [editingMaterial, setEditingMaterial] = useState<AdminMaterial | "new" | null>(null);
  const [editingModel, setEditingModel] = useState<AdminFurniture | null>(null);
  const [addingModel, setAddingModel] = useState(false);

  const filters: ProductFilters = {
    ...(kind !== "all" && { kind }),
    ...(status !== "all" && { status }),
    ...(storeId && { store_id: storeId }),
    ...(q && { q }),
  };
  const stores = useQuery({ queryKey: ["admin", "stores"], queryFn: listAdminStores });
  const overview = useQuery({
    queryKey: ["admin", "products", "overview", filters],
    queryFn: () => getProductsOverview(filters),
    placeholderData: keepPreviousData,
  });
  const list = useQuery({
    queryKey: ["admin", "products", "list", filters, category, page],
    queryFn: () => listAdminProducts({ ...filters, kind: category!.kind, category: category!.id, page, perPage: PER_PAGE }),
    enabled: category !== null,
    // Paging within one category keeps the old page up while the next loads; another category
    // shows its own loading state instead of the previous category's rows.
    placeholderData: (previous, previousQuery) =>
      sameCategory(previousQuery?.queryKey[4] as Category | null, category) ? previous : undefined,
  });

  const refresh = () => {
    onError(null);
    void queryClient.invalidateQueries({ queryKey: ["admin"] });
    void queryClient.invalidateQueries({ queryKey: ["materials"] });
  };
  const toggle = useMutation({
    mutationFn: (p: AdminProduct) => updateAdminMaterial(p.id, { is_active: !p.is_active }),
    onSuccess: refresh,
    onError: (err) => onError(requestError(err, "dokon.admin.mat.toggle_failed")),
  });
  const open = useMutation({
    mutationFn: async (p: AdminProduct): Promise<{ material: AdminMaterial } | { model: AdminFurniture }> =>
      p.kind === "materials" ? { material: await getAdminMaterial(p.id) } : { model: await getAdminFurniture(p.id) },
    onSuccess: (r) => {
      onError(null);
      if ("material" in r) setEditingMaterial(r.material);
      else setEditingModel(r.model);
    },
    onError: (err) => onError(requestError(err, "dokon.admin.products.load_failed")),
  });

  // Any filter or category change starts again from the first page.
  const filterBy = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1); };
  const listTop = useRef<HTMLDivElement>(null);
  const toListTop = () => listTop.current?.scrollIntoView?.({ block: "start", behavior: "smooth" });
  const choose = (next: Category | null) => { setCategory(next); setPage(1); toListTop(); };
  // A page can empty under the admin (its last row hidden, a model deleted): step back to the
  // last page that still has rows, rather than an empty list with no pager.
  const listed = list.data;
  useEffect(() => {
    if (listed && listed.items.length === 0 && listed.total > 0 && page > 1) {
      setPage(Math.max(1, Math.ceil(listed.total / PER_PAGE)));
    }
  }, [listed, page]);
  const goTo = (n: number) => { setPage(n); toListTop(); };

  const blocks = (overview.data?.categories ?? [])
    .map((c) => ({ ...c, label: kindLabel(c.kind, c.category, t) }))
    .sort((a, b) => a.label.localeCompare(b.label) || a.kind.localeCompare(b.kind));
  const needle = categorySearch.trim().toLocaleLowerCase();
  const isChosen = (b: { kind: ProductKind; category: string }) => sameCategory({ kind: b.kind, id: b.category }, category);
  const sideBlocks = needle ? blocks.filter((b) => isChosen(b) || b.label.toLocaleLowerCase().includes(needle)) : [...blocks];
  if (category && !blocks.some(isChosen)) {
    sideBlocks.push({
      kind: category.kind, category: category.id, total: list.data?.total ?? 0, items: [],
      label: kindLabel(category.kind, category.id, t),
    });
  }
  const total = overview.data?.total ?? 0;
  const busyId = toggle.isPending ? toggle.variables?.id : open.isPending ? open.variables?.id : undefined;
  const row = (p: AdminProduct) => (
    <ProductRow key={`${p.kind}:${p.id}`} product={p} busy={busyId === p.id} onOpen={(x) => { if (!open.isPending) open.mutate(x); }} onToggle={(x) => toggle.mutate(x)} />
  );

  return (
    <section className="space-y-3" aria-label={t("dokon.admin.tabs.products")}>
      <Panel className="flex flex-col gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <h2 className="min-w-0 flex-1 truncate text-base font-extrabold text-ink">
            {t("dokon.admin.products.title", { n: total })}
          </h2>
          <ActionMenu
            label={t("dokon.admin.products.add")}
            trigger={<><span>{t("dokon.admin.products.add")}</span><ChevronDown size={14} aria-hidden="true" /></>}
            triggerClassName="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#5B84F5] px-4 text-sm font-semibold text-white hover:bg-[#4a73e4]"
            actions={[
              { label: t("dokon.admin.products.add_material"), onSelect: () => setEditingMaterial("new") },
              { label: t("dokon.admin.products.add_model_item"), onSelect: () => setAddingModel(true) },
            ]}
          />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(e) => filterBy(setSearch)(e.target.value)}
              placeholder={t("dokon.admin.products.search")}
              aria-label={t("dokon.admin.products.search")}
              className={cn(field, "w-full pl-9 pr-3")}
            />
          </div>
          <select value={storeId} onChange={(e) => filterBy(setStoreId)(e.target.value)} aria-label={t("dokon.admin.dokon")} className={cn(field, "px-3 sm:w-56")}>
            <option value="">{t("dokon.admin.orders.all_stores")}</option>
            {(stores.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <ChipGroup
            label={t("dokon.admin.products.kind")}
            options={KINDS}
            value={kind}
            onChange={(v) => { filterBy(setKind)(v); if (category && v !== "all" && v !== category.kind) choose(null); }}
          />
          <ChipGroup label={t("dokon.admin.products.status")} options={STATUSES} value={status} onChange={filterBy(setStatus)} />
        </div>
      </Panel>

      <div className="grid gap-3 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start">
        <div className="min-w-0 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
          <input
            type="search"
            value={categorySearch}
            onChange={(e) => setCategorySearch(e.target.value)}
            placeholder={t("dokon.admin.products.category_search")}
            aria-label={t("dokon.admin.products.category_search")}
            className={cn(field, "mb-2 hidden h-9 w-full px-3 lg:block")}
          />
          <nav aria-label={t("dokon.admin.products.categories")} className="flex gap-1.5 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
            {[{ key: "all", label: t("dokon.admin.products.all_categories"), n: total, value: null as Category | null, kind: null as ProductKind | null },
              ...sideBlocks.map((b) => ({ key: `${b.kind}:${b.category}`, label: b.label, n: b.total, value: { kind: b.kind, id: b.category }, kind: b.kind }))]
              .map((c) => {
                const selected = c.value ? category?.kind === c.value.kind && category.id === c.value.id : category === null;
                const kindName = c.kind && kind === "all"
                  ? t(c.kind === "furniture" ? "dokon.admin.products.add_model_item" : "dokon.admin.products.add_material")
                  : null;
                return (
                  <button
                    key={c.key}
                    type="button"
                    aria-pressed={selected}
                    aria-label={kindName ? `${c.label} · ${kindName}` : undefined}
                    onClick={() => choose(c.value)}
                    className={cn(
                      "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B84F5]/70",
                      selected ? "bg-ink font-semibold text-card" : "bg-card text-ink hover:bg-ink/10",
                    )}
                  >
                    {kindName && c.kind && <KindIcon kind={c.kind} className="shrink-0 opacity-60" />}
                    <span className="min-w-0 flex-1 truncate text-left">{c.label}</span>
                    <span className={cn("text-xs", selected ? "text-card/80" : "text-ink-muted")}>{c.n}</span>
                  </button>
                );
              })}
          </nav>
        </div>

        <div ref={listTop} className="min-w-0 scroll-mt-4 space-y-3">
          {category === null ? (
            overview.isLoading ? (
              <div className="h-40 animate-pulse rounded-3xl bg-card" />
            ) : overview.isError ? (
              <Panel className="px-4 py-6 text-center text-sm text-ink-muted">{t("dokon.admin.yuklab_bolmadi")}</Panel>
            ) : blocks.length === 0 ? (
              <Panel className="px-4 py-6 text-center text-sm text-ink-muted">{t("dokon.admin.products.empty")}</Panel>
            ) : (
              blocks.map((b) => (
                <Panel key={`${b.kind}:${b.category}`} className="p-0">
                  <section aria-label={b.label}>
                    <h3 className="flex items-center gap-2 border-b border-line px-4 py-2 text-xs font-bold uppercase tracking-wide text-ink-muted">
                      {kind === "all" && <KindIcon kind={b.kind} className="shrink-0" />}
                      <span className="min-w-0 flex-1 truncate">{b.label}</span>
                      <span>{b.total}</span>
                    </h3>
                    <ul className="divide-y divide-line">{b.items.map(row)}</ul>
                    {b.total > b.items.length && (
                      <button
                        type="button"
                        onClick={() => choose({ kind: b.kind, id: b.category })}
                        className="flex w-full items-center justify-center gap-1.5 border-t border-line px-4 py-2.5 text-sm font-semibold text-[#5B84F5] hover:bg-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#5B84F5]/70"
                      >
                        {t("dokon.admin.products.see_all", { n: b.total })}
                        <ArrowRight size={14} aria-hidden="true" />
                      </button>
                    )}
                  </section>
                </Panel>
              ))
            )
          ) : list.isLoading ? (
            <div className="h-40 animate-pulse rounded-3xl bg-card" />
          ) : list.isError ? (
            <Panel className="px-4 py-6 text-center text-sm text-ink-muted">{t("dokon.admin.yuklab_bolmadi")}</Panel>
          ) : !list.data || list.data.items.length === 0 ? (
            <Panel className="px-4 py-6 text-center text-sm text-ink-muted">{t("dokon.admin.products.empty")}</Panel>
          ) : (
            <Panel className="p-0">
              <section aria-label={kindLabel(category.kind, category.id, t)}>
                <h3 className="flex items-center gap-2 border-b border-line px-4 py-2 text-xs font-bold uppercase tracking-wide text-ink-muted">
                  <span className="min-w-0 flex-1 truncate">{kindLabel(category.kind, category.id, t)}</span>
                  <span>{list.data.total}</span>
                </h3>
                <ul className={cn("divide-y divide-line transition-opacity", list.isPlaceholderData && "opacity-60")}>{list.data.items.map(row)}</ul>
              </section>
              <div className="border-t border-line px-4 py-3 empty:hidden">
                <Pager page={page} pages={Math.ceil(list.data.total / PER_PAGE)} onPage={goTo} />
              </div>
            </Panel>
          )}
        </div>
      </div>

      <MaterialFormDialog
        open={editingMaterial !== null}
        onOpenChange={(o) => { if (!o) setEditingMaterial(null); }}
        material={editingMaterial === "new" ? null : editingMaterial}
        stores={stores.data ?? []}
        onSaved={refresh}
      />
      <ModelEditDialog
        open={editingModel !== null}
        onOpenChange={(o) => { if (!o) { setEditingModel(null); refresh(); } }}
        model={editingModel}
        stores={stores.data ?? []}
        onError={onError}
      />
      <ModelFormDialog open={addingModel} onOpenChange={(o) => { setAddingModel(o); if (!o) refresh(); }} stores={stores.data ?? []} onError={onError} />
    </section>
  );
}
