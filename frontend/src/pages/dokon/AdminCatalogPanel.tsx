import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { TKey } from "@/i18n";
import { getPendingQueue, listAdminOrders, type AdminStore } from "@/lib/api";
import { cn } from "@/lib/utils";
import { CatalogOverview } from "./admin/CatalogOverview";
import { StoreProfile } from "./admin/StoreProfile";
import { ModerationQueue } from "./admin/ModerationQueue";
import { AdminOrders } from "./admin/AdminOrders";
import { AdminMaterials } from "./admin/AdminMaterials";
import { type FormError, formErrorText } from "@/lib/formError";

type Tab = "orders" | "products" | "stores" | "moderation";
const TABS: Array<{ id: Tab; labelKey: TKey }> = [
  { id: "orders", labelKey: "dokon.admin.tabs.orders" },
  { id: "products", labelKey: "dokon.admin.tabs.products" },
  { id: "stores", labelKey: "dokon.admin.tabs.stores" },
  { id: "moderation", labelKey: "dokon.admin.tabs.moderation" },
];
const isTab = (v: string | null): v is Tab => TABS.some((t) => t.id === v);

/**
 * Admin-only surface on the Do'kon page, one tab at a time: orders, products (materials and 3D
 * models), shops, and the moderation queue. The tab lives in `?tab=`; without one (or with an
 * unknown one) it opens on moderation when something waits for a decision, else on orders.
 */
export default function AdminCatalogPanel() {
  const { t } = useTranslation();
  const [error, setError] = useState<FormError>(null);
  const [selectedStore, setSelectedStore] = useState<AdminStore | null>(null);
  const [params, setParams] = useSearchParams();
  const queue = useQuery({ queryKey: ["admin", "moderation"], queryFn: getPendingQueue });
  const accepted = useQuery({
    queryKey: ["admin", "orders", "accepted-count"],
    queryFn: () => listAdminOrders({ status: "accepted", perPage: 100 }),
    refetchInterval: 30_000,
  });

  const pendingCount = queue.data
    ? queue.data.stores.length + queue.data.furniture.length + (queue.data.ustalar?.length ?? 0)
    : 0;
  const acceptedCount = accepted.data?.length ?? 0;
  const badges: Partial<Record<Tab, string>> = {
    orders: acceptedCount ? (acceptedCount >= 100 ? "99+" : String(acceptedCount)) : undefined,
    moderation: pendingCount ? String(pendingCount) : undefined,
  };

  const asked = params.get("tab");
  // Until the queue is in, a link without a tab waits rather than flashing the wrong one.
  const tab: Tab | null = isTab(asked) ? asked : queue.isPending ? null : pendingCount > 0 ? "moderation" : "orders";
  const choose = (next: Tab) => {
    setError(null);
    setParams((p) => { const n = new URLSearchParams(p); n.set("tab", next); return n; }, { replace: true });
  };

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4">
      <h1 className="text-lg font-semibold text-on-app">{t("dokon.admin.title")}</h1>

      <div role="tablist" aria-label={t("dokon.admin.tabs.label")} className="flex gap-1 overflow-x-auto rounded-2xl border border-line bg-card p-1">
        {TABS.map((item) => {
          const selected = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => choose(item.id)}
              className={cn(
                "inline-flex h-9 shrink-0 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B84F5]/70",
                selected ? "bg-ink text-card" : "text-ink-muted hover:bg-ink/10 hover:text-ink",
              )}
            >
              {t(item.labelKey)}
              {badges[item.id] && (
                <span className={cn("rounded-full px-1.5 text-[11px] font-bold", selected ? "bg-card/20" : "bg-orange-500/15 text-orange-600")}>
                  {badges[item.id]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 text-sm px-3 py-2">
          {formErrorText(t, error)}
        </div>
      )}

      <div role="tabpanel">
        {tab === "orders" && <AdminOrders onError={setError} />}
        {tab === "products" && <AdminMaterials onError={setError} />}
        {tab === "stores" && (selectedStore ? (
          <StoreProfile
            store={selectedStore}
            onBack={() => setSelectedStore(null)}
            onError={setError}
            onDeleted={() => setSelectedStore(null)}
          />
        ) : (
          <CatalogOverview onError={setError} onSelectStore={setSelectedStore} />
        ))}
        {tab === "moderation" && <ModerationQueue onError={setError} />}
      </div>
    </div>
  );
}
