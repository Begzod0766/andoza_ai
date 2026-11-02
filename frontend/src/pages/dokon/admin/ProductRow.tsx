import { Box, Layers, MoreHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { MATERIAL_UNITS, type AdminProduct } from "@/lib/api";
import { cn, formatUZS } from "@/lib/utils";
import { ActionMenu } from "./ActionMenu";
import { optionLabel } from "./materialLabels";

/** The kind of a product as a small icon (box = 3D model, layers = material), with its name for screen readers. */
export function KindIcon({ kind, className }: { kind: AdminProduct["kind"]; className?: string }) {
  const { t } = useTranslation();
  const Icon = kind === "furniture" ? Box : Layers;
  return <Icon size={12} className={className} aria-label={t(kind === "furniture" ? "dokon.admin.products.add_model_item" : "dokon.admin.products.add_material")} />;
}

/**
 * One product in the admin list: a click opens its edit dialog; "⋯" holds the rest (a material's
 * hide/show — a model is hidden from its own dialog). The price keeps one column from md up, and
 * goes under the name on a phone. Only a hidden product carries a status pill.
 */
export function ProductRow({ product: p, busy, onOpen, onToggle }: {
  product: AdminProduct;
  busy: boolean;
  onOpen: (p: AdminProduct) => void;
  onToggle: (p: AdminProduct) => void;
}) {
  const { t } = useTranslation();
  const price = p.price_uzs == null
    ? "—"
    : p.unit ? `${formatUZS(p.price_uzs)} / ${optionLabel(MATERIAL_UNITS, p.unit, t)}` : formatUZS(p.price_uzs);
  const actions = [
    { label: t("dokon.admin.tahrirlash"), onSelect: () => onOpen(p) },
    ...(p.kind === "materials"
      ? [{ label: p.is_active ? t("dokon.admin.mat.hide") : t("dokon.admin.mat.show"), onSelect: () => onToggle(p) }]
      : []),
  ];

  return (
    <li className={cn("flex items-center gap-2 pr-3", busy && "opacity-60")}>
      <button
        type="button"
        onClick={() => onOpen(p)}
        className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pl-4 text-left transition-colors hover:bg-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#5B84F5]/70"
      >
        <span className="relative h-11 w-11 shrink-0">
          <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-xl bg-card-soft text-sm font-bold text-ink-muted">
            {p.image_url ? <img src={p.image_url} alt="" className="h-full w-full object-cover" loading="lazy" /> : p.name.slice(0, 1).toUpperCase()}
          </span>
          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-line bg-card text-ink-muted">
            <KindIcon kind={p.kind} />
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 break-words text-sm font-bold text-ink" title={p.name}>{p.name}</span>
          <span className="block truncate text-xs text-ink-muted">{p.store_name ?? "—"}</span>
          <span className="block text-xs font-semibold text-ink md:hidden">{price}</span>
        </span>
        {!p.is_active && (
          <span className="shrink-0 whitespace-nowrap rounded-full border border-line bg-card-soft px-2 py-0.5 text-[11px] font-bold text-ink-muted">
            {t("dokon.admin.products.status_hidden")}
          </span>
        )}
        <span className="hidden w-40 shrink-0 whitespace-nowrap text-right text-sm font-semibold text-ink md:block">{price}</span>
      </button>
      <ActionMenu
        label={t("dokon.admin.products.actions")}
        trigger={<MoreHorizontal size={18} aria-hidden="true" />}
        actions={actions}
        triggerClassName="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted hover:bg-ink/10 hover:text-ink"
      />
    </li>
  );
}
