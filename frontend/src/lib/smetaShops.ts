/**
 * The estimate by shop: which lines each shop sells, what they come to, and how to find the
 * shop on a map. Lines with no shop behind them (an average-price stand-in, a work line) end
 * up in one last group.
 */
import type { EstimateLine, EstimateStore } from "@/lib/api";
import { groupKeyFor, type GroupKey, type IndexedLine } from "@/lib/smetaGroups";

export const NO_SHOP_KEY = "__no_shop__";

export interface ShopGroup {
  /** The shop's id; "name:<name>" for a line that names a shop we have no row for; NO_SHOP_KEY. */
  key: string;
  /** The shop's card details, when the estimate listed it. */
  store: EstimateStore | null;
  /** What to call the group: the shop's name, or null for the no-shop group. */
  name: string | null;
  items: IndexedLine[];
  subtotal: number;
}

/** Groups the lines by shop, biggest subtotal first and the no-shop group last. A saved
 *  estimate from before lines carried a store_id still groups, by the shop's name. Lines whose
 *  category is in *exclude* (the "repair only" toggle leaves furniture out) are left out. */
export function groupLinesByShop(
  lines: EstimateLine[],
  stores: EstimateStore[] | undefined,
  exclude?: ReadonlySet<GroupKey>,
): ShopGroup[] {
  const byId = new Map((stores ?? []).map((s) => [s.id, s]));
  const groups = new Map<string, ShopGroup>();
  lines.forEach((line, index) => {
    if (exclude?.has(groupKeyFor(line.category))) return;
    const store = line.store_id ? byId.get(line.store_id) ?? null : null;
    const name = store?.name ?? line.store_name ?? null;
    const key = store ? store.id : name ? `name:${name}` : NO_SHOP_KEY;
    let group = groups.get(key);
    if (!group) {
      group = { key, store, name: key === NO_SHOP_KEY ? null : name, items: [], subtotal: 0 };
      groups.set(key, group);
    }
    group.items.push({ line, index });
    group.subtotal += line.total_uzs;
  });
  const shops = [...groups.values()].filter((g) => g.key !== NO_SHOP_KEY).sort((a, b) => b.subtotal - a.subtotal);
  const rest = groups.get(NO_SHOP_KEY);
  return rest ? [...shops, rest] : shops;
}

/** The DOM id of a shop group's section, for the map's markers to scroll to. */
export function shopSectionId(key: string): string {
  return `smeta-shop-${key.replace(/[^A-Za-z0-9_-]/g, "_")}`;
}

function hasPoint(store: Pick<EstimateStore, "lat" | "lng"> | null | undefined): store is EstimateStore & { lat: number; lng: number } {
  return !!store && Number.isFinite(store.lat) && Number.isFinite(store.lng) && store.lat !== null && store.lng !== null;
}

/** Yandex and Google Maps links at the shop's point (https links: on a phone they open the
 *  maps app when it is installed); null for a shop with no point. */
export function mapLinks(store: Pick<EstimateStore, "lat" | "lng"> | null | undefined): { yandex: string; google: string } | null {
  if (!hasPoint(store)) return null;
  const { lat, lng } = store;
  return {
    // Yandex takes longitude first (pt=lng,lat).
    yandex: `https://yandex.uz/maps/?pt=${lng},${lat}&z=16&l=map`,
    google: `https://www.google.com/maps/search/?api=1&query=${lat}%2C${lng}`,
  };
}

/** The shops that can go on the map: those with a point. */
export function mappableShops(stores: EstimateStore[]): Array<EstimateStore & { lat: number; lng: number }> {
  return stores.filter(hasPoint);
}
