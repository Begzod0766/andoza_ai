import { describe, expect, it } from "vitest";
import type { EstimateLine, EstimateStore } from "@/lib/api";
import { groupLinesByShop, mapLinks, mappableShops, NO_SHOP_KEY } from "@/lib/smetaShops";

const line = (over: Partial<EstimateLine>): EstimateLine => ({
  label: "x", formula: "", quantity: 1, unit: "dona", unit_price: 0, total_uzs: 0,
  is_approximate: false, store_id: null, category: "boyoq", ...over,
});

const shop = (over: Partial<EstimateStore>): EstimateStore => ({
  id: "s1", name: "Bo'yoq Markazi", district: "Chilonzor", address: null, lat: null, lng: null,
  phone: null, telegram: null, ...over,
});

describe("groupLinesByShop", () => {
  const stores = [shop({ id: "a", name: "A do'kon" }), shop({ id: "b", name: "B do'kon" })];
  const lines = [
    line({ store_id: "a", total_uzs: 100 }),
    line({ store_id: null, category: "ish", total_uzs: 50, is_approximate: true }),
    line({ store_id: "b", total_uzs: 900 }),
    line({ store_id: "a", total_uzs: 300, category: "jihoz" }),
  ];

  it("groups by shop, biggest first, with the no-shop group last", () => {
    const groups = groupLinesByShop(lines, stores);
    expect(groups.map((g) => g.key)).toEqual(["b", "a", NO_SHOP_KEY]);
    expect(groups.map((g) => g.subtotal)).toEqual([900, 400, 50]);
    expect(groups[1].items.map((i) => i.index)).toEqual([0, 3]);
    expect(groups[0].store?.name).toBe("B do'kon");
    expect(groups[2].store).toBeNull();
  });

  it("leaves out excluded categories (furniture toggle) and drops empty groups", () => {
    const groups = groupLinesByShop(lines, stores, new Set(["jihoz"]));
    expect(groups.find((g) => g.key === "a")?.subtotal).toBe(100);
    const onlyFurniture = groupLinesByShop([line({ store_id: "a", category: "jihoz", total_uzs: 5 })], stores, new Set(["jihoz"]));
    expect(onlyFurniture).toEqual([]);
  });

  it("groups an old estimate (no store_id, no stores list) by the shop name", () => {
    const old = [line({ store_name: "Eski do'kon", total_uzs: 10 }), line({ store_name: "Eski do'kon", total_uzs: 5 }), line({ total_uzs: 1 })];
    const groups = groupLinesByShop(old, undefined);
    expect(groups.map((g) => [g.name, g.subtotal])).toEqual([["Eski do'kon", 15], [null, 1]]);
    expect(groups[0].store).toBeNull();
  });

  it("a line pointing at a shop the list lacks still groups, under its name", () => {
    const groups = groupLinesByShop([line({ store_id: "zz", store_name: "Z", total_uzs: 3 })], []);
    expect(groups[0].name).toBe("Z");
  });
});

describe("mapLinks", () => {
  it("builds Yandex and Google links at the point", () => {
    const links = mapLinks(shop({ lat: 41.311081, lng: 69.240562 }));
    expect(links?.yandex).toBe("https://yandex.uz/maps/?pt=69.240562,41.311081&z=16&l=map");
    expect(links?.google).toBe("https://www.google.com/maps/search/?api=1&query=41.311081%2C69.240562");
  });

  it("gives nothing without a point", () => {
    expect(mapLinks(shop({}))).toBeNull();
    expect(mapLinks(shop({ lat: 41.3 }))).toBeNull();
    expect(mapLinks(null)).toBeNull();
  });
});

describe("mappableShops", () => {
  it("keeps only the shops with a point", () => {
    const shops = [shop({ id: "a", lat: 41, lng: 69 }), shop({ id: "b" })];
    expect(mappableShops(shops).map((s) => s.id)).toEqual(["a"]);
  });
});
