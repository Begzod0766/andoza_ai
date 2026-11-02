import { useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, ImageOff, Pencil, Plus, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import type { TKey } from "@/i18n";
import {
  MATERIAL_CATEGORIES, MATERIAL_UNITS, getCategoryCounts, listAdminFurniture, listAdminMaterials, listAdminStores, updateAdminMaterial,
  type AdminFurniture, type AdminMaterial,
} from "@/lib/api";
import { useDebounce } from "@/hooks/useDebounce";
import { cn, formatUZS } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { FilterChip } from "./FilterChip";
import { MaterialFormDialog } from "./MaterialFormDialog";
import { ModelEditDialog } from "./ModelEditDialog";
import { ModelFormDialog } from "./ModelFormDialog";
import { categoryLabel } from "./labels";
import { optionLabel } from "./materialLabels";
import { requestError, type FormError } from "@/lib/formError";

const PER_PAGE = 50;
type Kind = "materials" | "furniture";
type KindFilter = Kind | "all";
type StatusFilter = "all" | "active" | "hidden";

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

/** A material or a 3D model, as one row of the product list. */
type Product =
  | { kind: "materials"; id: string; category: string; active: boolean; item: AdminMaterial }
  | { kind: "furniture"; id: string; category: string; active: boolean; item: AdminFurniture };

const kindCategoryLabel = (kind: Kind, category: string, t: TFunction) =>
  kind === "materials" ? optionLabel(MATERIAL_CATEGORIES, category, t) : categoryLabel(category, t);

function ProductRow({ product: p, busy, onEdit, onToggle }: {
  product: Product; busy: boolean; onEdit: (p: Product) => void; onToggle: (m: AdminMaterial) => void;
}) {
  const { t } = useTranslation();
  const name = p.item.name_uz;
  const thumb = p.kind === "materials" ? p.item.image_url : p.item.thumbnail_url;
  const priceText = p.kind === "materials"
    ? `${formatUZS(p.item.price_uzs)} / ${optionLabel(MATERIAL_UNITS, p.item.unit, t)}`
    : p.item.price_uzs != null ? formatUZS(p.item.price_uzs) : "—";
  return (
    <li className={cn("flex items-center gap-3 px-4 py-2.5", !p.active && "opacity-70")}>
      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-card-soft">
        {thumb ? <img src={thumb} alt="" className="h-full w-full object-cover" loading="lazy" /> : <ImageOff size={16} className="text-ink-muted" aria-hidden="true" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-ink" title={name}>{name}</p>
        <p className="truncate text-xs text-ink-muted">
          {p.item.store_name ?? "—"} · {kindCategoryLabel(p.kind, p.category, t)} · {t(p.kind === "materials" ? "dokon.admin.products.material" : "dokon.admin.products.model")}
        </p>
      </div>
      <span className="hidden whitespace-nowrap text-sm font-semibold text-ink sm:block">{priceText}</span>
      <span className={cn(
        "hidden whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-bold sm:inline",
        p.active ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600" : "border-line bg-card-soft text-ink-muted",
      )}>
        {t(p.active ? "dokon.admin.products.status_active" : "dokon.admin.products.status_hidden")}
      </span>
      <Button size="sm" variant="soft" leftIcon={<Pencil size={14} aria-hidden="true" />} onClick={() => onEdit(p)}>
        {t("dokon.admin.tahrirlash")}
      </Button>
      {/* A model is hidden from its edit dialog; a material's dialog has no switch, so it is here. */}
      {p.kind === "materials" && (
        <Button
          size="sm"
          variant="soft"
          loading={busy}
          leftIcon={p.active ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
          onClick={() => onToggle(p.item)}
        >
          {p.active ? t("dokon.admin.mat.hide") : t("dokon.admin.mat.show")}
        </Button>
      )}
    </li>
  );
}

/**
 * Every product in the shop catalogue, materials and 3D models together: narrowed by kind, shop,
 * name and status, with the categories (and how many each holds) down the side. With every
 * category showing, rows are grouped under category headings.
 */
export function ProductsTab({ onError }: { onError: (message: FormError) => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<KindFilter>("all");
  const [storeId, setStoreId] = useState("");
  const [search, setSearch] = useState("");
  const q = useDebounce(search.trim(), 300);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [category, setCategory] = useState<{ kind: Kind; id: string } | null>(null);
  const [editing, setEditing] = useState<Product | "new-material" | null>(null);
  const [addingModel, setAddingModel] = useState(false);
  const editingProduct = editing === "new-material" ? null : editing;

  const base = { store_id: storeId || undefined, q: q || undefined };
  const wants = (k: Kind) => (kind === "all" || kind === k) && (!category || category.kind === k);
  const stores = useQuery({ queryKey: ["admin", "stores"], queryFn: listAdminStores });
  const counts = useQuery({ queryKey: ["admin", "category-counts", base], queryFn: () => getCategoryCounts(base) });
  const materials = useInfiniteQuery({
    queryKey: ["admin", "materials", "products", base, category?.kind === "materials" ? category.id : null],
    queryFn: ({ pageParam }) => listAdminMaterials({
      ...base, category: category?.kind === "materials" ? category.id : undefined, page: pageParam, per_page: PER_PAGE,
    }),
    initialPageParam: 1,
    getNextPageParam: (last, all) => (all.length * PER_PAGE < last.total ? all.length + 1 : undefined),
    enabled: wants("materials"),
  });
  const furniture = useInfiniteQuery({
    queryKey: ["admin", "furniture", "products", base, category?.kind === "furniture" ? category.id : null],
    queryFn: ({ pageParam }) => listAdminFurniture({
      ...base, category: category?.kind === "furniture" ? category.id : undefined, page: pageParam,
    }),
    initialPageParam: 1,
    getNextPageParam: (last, all) => (last.length >= PER_PAGE ? all.length + 1 : undefined),
    enabled: wants("furniture"),
  });

  const rows: Product[] = [
    ...(wants("materials") ? (materials.data?.pages.flatMap((p) => p.items) ?? []) : [])
      .map((m): Product => ({ kind: "materials", id: m.id, category: m.category, active: m.is_active, item: m })),
    ...(wants("furniture") ? (furniture.data?.pages.flat() ?? []) : [])
      .map((f): Product => ({ kind: "furniture", id: f.id, category: f.category, active: f.is_active, item: f })),
  ].filter((p) => status === "all" || (status === "active") === p.active);

  const sideCategories = (["materials", "furniture"] as const)
    .filter((k) => kind === "all" || kind === k)
    .flatMap((k) => Object.entries(counts.data?.[k] ?? {}).map(([id, n]) => ({ kind: k, id, n, label: kindCategoryLabel(k, id, t) })))
    .sort((a, b) => a.label.localeCompare(b.label));
  const total = sideCategories.reduce((sum, c) => sum + c.n, 0);

  // Under category headings while every category shows; one flat list for one category.
  const groups = category
    ? [{ key: "one", label: null as string | null, rows }]
    : sideCategories
        .map((c) => ({ key: `${c.kind}:${c.id}`, label: c.label, rows: rows.filter((r) => r.kind === c.kind && r.category === c.id) }))
        .concat([{
          key: "other", label: "—",
          rows: rows.filter((r) => !sideCategories.some((c) => c.kind === r.kind && c.id === r.category)),
        }])
        .filter((g) => g.rows.length > 0);

  const loading = (wants("materials") && materials.isLoading) || (wants("furniture") && furniture.isLoading);
  const failed = (wants("materials") && materials.isError) || (wants("furniture") && furniture.isError);
  const more = (wants("materials") && materials.hasNextPage) || (wants("furniture") && furniture.hasNextPage);
  const refresh = () => {
    onError(null);
    void queryClient.invalidateQueries({ queryKey: ["admin"] });
    void queryClient.invalidateQueries({ queryKey: ["materials"] });
  };
  const toggle = useMutation({
    mutationFn: (m: AdminMaterial) => updateAdminMaterial(m.id, { is_active: !m.is_active }),
    onSuccess: refresh,
    onError: (err) => onError(requestError(err, "dokon.admin.mat.toggle_failed")),
  });
  const pick = (next: { kind: Kind; id: string } | null) => setCategory(next);

  return (
    <section className="space-y-3" aria-label={t("dokon.admin.tabs.products")}>
      <Panel className="flex flex-col gap-3 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1 basis-56">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("dokon.admin.products.search")}
              aria-label={t("dokon.admin.products.search")}
              className="h-9 w-full rounded-xl border border-line bg-card-soft pl-9 pr-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-[#5B84F5]/70"
            />
          </div>
          <select
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
            aria-label={t("dokon.admin.dokon")}
            className="h-9 rounded-xl border border-line bg-card-soft px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-[#5B84F5]/70"
          >
            <option value="">{t("dokon.admin.orders.all_stores")}</option>
            {(stores.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <Button size="sm" leftIcon={<Plus size={14} aria-hidden="true" />} onClick={() => setEditing("new-material")}>
            {t("dokon.admin.mat.add")}
          </Button>
          <Button size="sm" variant="soft" leftIcon={<Plus size={14} aria-hidden="true" />} onClick={() => setAddingModel(true)}>
            {t("dokon.admin.products.add_model")}
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("dokon.admin.products.kind")}>
            {KINDS.map((k) => (
              <FilterChip key={k.value} pressed={kind === k.value} onClick={() => { setKind(k.value); if (category && k.value !== "all" && k.value !== category.kind) pick(null); }}>
                {t(k.labelKey)}
              </FilterChip>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("dokon.admin.products.status")}>
            {STATUSES.map((s) => (
              <FilterChip key={s.value} pressed={status === s.value} onClick={() => setStatus(s.value)}>
                {t(s.labelKey)}
              </FilterChip>
            ))}
          </div>
        </div>
      </Panel>

      <div className="grid gap-3 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <nav aria-label={t("dokon.admin.products.categories")} className="flex gap-1.5 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
          {[{ key: "all", label: t("dokon.admin.products.all_categories"), n: total, value: null as { kind: Kind; id: string } | null },
            ...sideCategories.map((c) => ({ key: `${c.kind}:${c.id}`, label: c.label, n: c.n, value: { kind: c.kind, id: c.id } }))]
            .map((c) => {
              const selected = c.value ? category?.kind === c.value.kind && category.id === c.value.id : category === null;
              return (
                <button
                  key={c.key}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => pick(c.value)}
                  className={cn(
                    "flex shrink-0 items-center justify-between gap-3 whitespace-nowrap rounded-xl px-3 py-2 text-sm transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B84F5]/70",
                    selected ? "bg-ink font-semibold text-card" : "bg-card text-ink hover:bg-ink/10",
                  )}
                >
                  <span className="truncate">{c.label}</span>
                  <span className={cn("text-xs", selected ? "text-card/80" : "text-ink-muted")}>{c.n}</span>
                </button>
              );
            })}
        </nav>

        <div className="min-w-0 space-y-3">
          {loading ? (
            <div className="h-24 animate-pulse rounded-3xl bg-card" />
          ) : failed ? (
            <Panel className="px-4 py-6 text-center text-sm text-ink-muted">{t("dokon.admin.yuklab_bolmadi")}</Panel>
          ) : rows.length === 0 ? (
            <Panel className="px-4 py-6 text-center text-sm text-ink-muted">{t("dokon.admin.products.empty")}</Panel>
          ) : (
            groups.map((g) => (
              <Panel key={g.key} className="overflow-hidden p-0">
                <section aria-label={g.label ?? undefined}>
                  {g.label && (
                    <h3 className="flex items-center justify-between border-b border-line px-4 py-2 text-xs font-bold uppercase tracking-wide text-ink-muted">
                      {g.label} <span>{g.rows.length}</span>
                    </h3>
                  )}
                  <ul className="divide-y divide-line">
                    {g.rows.map((p) => <ProductRow
                        key={`${p.kind}:${p.id}`}
                        product={p}
                        busy={toggle.isPending && toggle.variables?.id === p.id}
                        onEdit={setEditing}
                        onToggle={(m) => toggle.mutate(m)}
                      />)}
                  </ul>
                </section>
              </Panel>
            ))
          )}
          {more && !loading && (
            <Button
              variant="soft"
              className="w-full"
              loading={materials.isFetchingNextPage || furniture.isFetchingNextPage}
              onClick={() => {
                if (wants("materials") && materials.hasNextPage) void materials.fetchNextPage();
                if (wants("furniture") && furniture.hasNextPage) void furniture.fetchNextPage();
              }}
            >
              {t("dokon.admin.products.more")}
            </Button>
          )}
        </div>
      </div>

      <MaterialFormDialog
        open={editing === "new-material" || editingProduct?.kind === "materials"}
        onOpenChange={(o) => { if (!o) setEditing(null); }}
        material={editingProduct?.kind === "materials" ? editingProduct.item : null}
        stores={stores.data ?? []}
        onSaved={refresh}
      />
      <ModelEditDialog
        open={editingProduct?.kind === "furniture"}
        onOpenChange={(o) => { if (!o) { setEditing(null); refresh(); } }}
        model={editingProduct?.kind === "furniture" ? editingProduct.item : null}
        stores={stores.data ?? []}
        onError={onError}
      />
      <ModelFormDialog open={addingModel} onOpenChange={setAddingModel} stores={stores.data ?? []} onError={onError} />
    </section>
  );
}
