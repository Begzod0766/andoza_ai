import { apiClient } from "./client";
import type { TKey } from "@/i18n";
import { LIGHT_TYPES } from "../lightCatalog";

// ---------- Admin: materials (shop products used by the room estimate) ----------
//
// Mirrors backend/app/schemas/admin_materials.py. Admin-only (403 otherwise).
// Materials are never deleted — hiding is `is_active: false`.

export interface AdminMaterial {
  id: string;
  store_id: string;
  store_name: string | null;
  category: string;
  name_uz: string;
  unit: string;
  price_uzs: number;
  pack_qty: number | null;
  pack_unit: string | null;
  smeta_key: string | null;
  roll_width_cm: number | null;
  roll_length_m: number | null;
  color_hex: string | null;
  image_url: string | null;
  is_active: boolean;
  /** False when the shop is closed, pending or rejected: users don't see the product. */
  store_open?: boolean;
}

export interface MaterialInput {
  store_id: string;
  category: string;
  name_uz: string;
  unit: string;
  price_uzs: number;
  pack_qty?: number | null;
  pack_unit?: string | null;
  smeta_key?: string | null;
  roll_width_cm?: number | null;
  roll_length_m?: number | null;
}

export interface AdminMaterialsPage {
  items: AdminMaterial[];
  total: number;
  page: number;
  per_page: number;
}

export interface AdminMaterialsQuery {
  category?: string;
  store_id?: string;
  smeta?: boolean;
  q?: string;
  page?: number;
  per_page?: number;
}

export async function listAdminMaterials(
  params: AdminMaterialsQuery = {},
): Promise<AdminMaterialsPage> {
  const qs = new URLSearchParams();
  if (params.category) qs.set("category", params.category);
  if (params.store_id) qs.set("store_id", params.store_id);
  if (params.smeta) qs.set("smeta", "true");
  if (params.q) qs.set("q", params.q);
  if (params.page) qs.set("page", String(params.page));
  if (params.per_page) qs.set("per_page", String(params.per_page));
  const s = qs.toString();
  return apiClient<AdminMaterialsPage>(`/admin/materials${s ? `?${s}` : ""}`);
}

export async function getAdminMaterial(id: string): Promise<AdminMaterial> {
  return apiClient<AdminMaterial>(`/admin/materials/${encodeURIComponent(id)}`);
}

export async function createAdminMaterial(input: MaterialInput): Promise<AdminMaterial> {
  return apiClient<AdminMaterial>("/admin/materials", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateAdminMaterial(
  id: string,
  patch: Partial<MaterialInput> & { is_active?: boolean },
): Promise<AdminMaterial> {
  return apiClient<AdminMaterial>(`/admin/materials/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

/** An option of an admin select: `labelKey` is translated while rendering (never at module load). */
export interface LabelledOption {
  id: string;
  labelKey: TKey;
}

export const MATERIAL_CATEGORIES: LabelledOption[] = [
  { id: "boyoq", labelKey: "dokon.admin.category.boyoq" },
  { id: "oboy", labelKey: "dokon.admin.category.oboy" },
  { id: "dekorativ", labelKey: "dokon.admin.category.dekorativ" },
  { id: "laminat", labelKey: "dokon.admin.category.laminat" },
  { id: "parket", labelKey: "dokon.admin.category.parket" },
  { id: "plitka", labelKey: "dokon.admin.category.plitka" },
  { id: "eshik", labelKey: "dokon.admin.category.eshik" },
  { id: "deraza", labelKey: "dokon.admin.category.deraza" },
  { id: "gips", labelKey: "dokon.admin.category.gips" },
  { id: "sement", labelKey: "dokon.admin.category.sement" },
  { id: "santexnika", labelKey: "dokon.admin.category.santexnika" },
  { id: "elektr_mat", labelKey: "dokon.admin.category.elektr_mat" },
  { id: "ldsp", labelKey: "dokon.admin.category.ldsp" },
  { id: "mdf", labelKey: "dokon.admin.category.mdf" },
  { id: "hdf", labelKey: "dokon.admin.category.hdf" },
  { id: "kromka", labelKey: "dokon.admin.category.kromka" },
  { id: "furnitura", labelKey: "dokon.admin.category.furnitura" },
];

export const MATERIAL_UNITS: LabelledOption[] = [
  { id: "litr", labelKey: "dokon.admin.unit.litr" },
  { id: "rulon", labelKey: "dokon.admin.unit.rulon" },
  { id: "m2", labelKey: "dokon.admin.unit.m2" },
  { id: "qop", labelKey: "dokon.admin.unit.qop" },
  { id: "dona", labelKey: "dokon.admin.unit.dona" },
  { id: "m", labelKey: "dokon.admin.unit.m" },
  { id: "komplekt", labelKey: "dokon.admin.unit.komplekt" },
];

/** Pack units the backend accepts (a pydantic pattern; anything else is a 422). */
export const PACK_UNITS: LabelledOption[] = [
  { id: "kg", labelKey: "dokon.admin.unit.kg" },
  { id: "litr", labelKey: "dokon.admin.unit.litr" },
  { id: "m", labelKey: "dokon.admin.unit.m" },
  { id: "m2", labelKey: "dokon.admin.unit.m2" },
  { id: "dona", labelKey: "dokon.admin.unit.dona" },
];

export interface SmetaKeyOption extends LabelledOption {
  /** Light fixtures read "Chiroq: <name>": `labelKey` is then the fixture's own name. */
  light?: boolean;
  /** Pack unit the key needs; null when it has none. */
  packUnit: string | null;
  /** Sale unit the key is restricted to, when it has one. */
  unit?: string;
}

// Mirrors backend/app/services/smeta_keys.py.
export const SMETA_KEYS: SmetaKeyOption[] = [
  { id: "suvoq", labelKey: "dokon.admin.smeta_key.suvoq", packUnit: "kg" },
  { id: "grunt", labelKey: "dokon.admin.smeta_key.grunt", packUnit: "kg" },
  { id: "shpatlyovka", labelKey: "dokon.admin.smeta_key.shpatlyovka", packUnit: "kg" },
  { id: "plintus", labelKey: "dokon.admin.smeta_key.plintus", packUnit: "m" },
  { id: "gipsokarton", labelKey: "dokon.admin.smeta_key.gipsokarton", packUnit: "m2" },
  // A kitchen backsplash in glass (spec 2026-11-14), priced by the square metre
  { id: "skinali", labelKey: "dokon.admin.smeta_key.skinali", packUnit: "m2" },
  // An electric towel rail and its moisture-proof socket (2026-11-14): sold by the piece
  { id: "sochiq_quritgich_el", labelKey: "dokon.admin.smeta_key.sochiq_quritgich_el", packUnit: null, unit: "dona" },
  { id: "rozetka_ip44", labelKey: "dokon.admin.smeta_key.rozetka_ip44", packUnit: null, unit: "dona" },
  { id: "profil", labelKey: "dokon.admin.smeta_key.profil", packUnit: "m" },
  { id: "led_lenta", labelKey: "dokon.admin.smeta_key.led_lenta", packUnit: "m" },
  { id: "kabel", labelKey: "dokon.admin.smeta_key.kabel", packUnit: null, unit: "m" },
  { id: "galtel", labelKey: "dokon.admin.smeta_key.galtel", packUnit: "m" },
  // Tile work and waterproofing (spec 2026-11-10)
  { id: "plitka_yelimi", labelKey: "dokon.admin.smeta_key.plitka_yelimi", packUnit: "kg" },
  { id: "zatirka", labelKey: "dokon.admin.smeta_key.zatirka", packUnit: "kg" },
  { id: "gidro_mastika", labelKey: "dokon.admin.smeta_key.gidro_mastika", packUnit: "kg" },
  { id: "gidro_lenta", labelKey: "dokon.admin.smeta_key.gidro_lenta", packUnit: "m" },
  // A bathroom's extras (spec 2026-11-10): sold by the piece
  { id: "ventilyator", labelKey: "dokon.admin.smeta_key.ventilyator", packUnit: null, unit: "dona" },
  { id: "sochiq_quritgich", labelKey: "dokon.admin.smeta_key.sochiq_quritgich", packUnit: null, unit: "dona" },
  // A fixture's own parts (2026-11-13): sold by the piece
  { id: "smesitel_rakovina", labelKey: "dokon.admin.smeta_key.smesitel_rakovina", packUnit: null, unit: "dona" },
  { id: "smesitel_oshxona", labelKey: "dokon.admin.smeta_key.smesitel_oshxona", packUnit: null, unit: "dona" },
  { id: "smesitel_vanna", labelKey: "dokon.admin.smeta_key.smesitel_vanna", packUnit: null, unit: "dona" },
  { id: "smesitel_dush", labelKey: "dokon.admin.smeta_key.smesitel_dush", packUnit: null, unit: "dona" },
  { id: "smesitel_bide", labelKey: "dokon.admin.smeta_key.smesitel_bide", packUnit: null, unit: "dona" },
  { id: "sifon_rakovina", labelKey: "dokon.admin.smeta_key.sifon_rakovina", packUnit: null, unit: "dona" },
  { id: "sifon_oshxona", labelKey: "dokon.admin.smeta_key.sifon_oshxona", packUnit: null, unit: "dona" },
  { id: "sifon_vanna", labelKey: "dokon.admin.smeta_key.sifon_vanna", packUnit: null, unit: "dona" },
  { id: "sifon_dush", labelKey: "dokon.admin.smeta_key.sifon_dush", packUnit: null, unit: "dona" },
  { id: "gofra_unitaz", labelKey: "dokon.admin.smeta_key.gofra_unitaz", packUnit: null, unit: "dona" },
  { id: "podvodka", labelKey: "dokon.admin.smeta_key.podvodka", packUnit: null, unit: "dona" },
  // A wall-hung toilet's frame and a water heater (2026-11-13): sold by the piece
  { id: "installyatsiya", labelKey: "dokon.admin.smeta_key.installyatsiya", packUnit: null, unit: "dona" },
  { id: "boyler", labelKey: "dokon.admin.smeta_key.boyler", packUnit: null, unit: "dona" },
  // A washing machine's tap and trap (2026-11-13): sold by the piece
  { id: "kran_kir", labelKey: "dokon.admin.smeta_key.kran_kir", packUnit: null, unit: "dona" },
  { id: "sifon_kir", labelKey: "dokon.admin.smeta_key.sifon_kir", packUnit: null, unit: "dona" },
  // A floor drain (2026-11-13): sold by the piece
  { id: "trap_pol", labelKey: "dokon.admin.smeta_key.trap_pol", packUnit: null, unit: "dona" },
  // The water inlet unit (2026-11-14): sold by the piece
  { id: "hisoblagich_suv", labelKey: "dokon.admin.smeta_key.hisoblagich_suv", packUnit: null, unit: "dona" },
  { id: "filtr_suv", labelKey: "dokon.admin.smeta_key.filtr_suv", packUnit: null, unit: "dona" },
  { id: "reduktor", labelKey: "dokon.admin.smeta_key.reduktor", packUnit: null, unit: "dona" },
  { id: "klapan_teskari", labelKey: "dokon.admin.smeta_key.klapan_teskari", packUnit: null, unit: "dona" },
  // The drywall box around a wall-hung toilet frame (2026-11-14): a moisture-resistant sheet, by the piece
  { id: "gipsokarton_nam", labelKey: "dokon.admin.smeta_key.gipsokarton_nam", packUnit: null, unit: "dona" },
  ...LIGHT_TYPES.map((t) => ({
    id: `light:${t.id}`,
    labelKey: t.nameKey,
    light: true,
    packUnit: null,
    unit: "dona",
  })),
];
