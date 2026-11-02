import { apiClient } from "./client";

/** Materials and 3D models as one admin product list. */
export type ProductKind = "materials" | "furniture";

export interface AdminProduct {
  kind: ProductKind;
  id: string;
  name: string;
  store_id: string | null;
  store_name: string | null;
  category: string;
  price_uzs: number | null;
  /** Materials only: what the price is for. */
  unit: string | null;
  image_url: string | null;
  is_active: boolean;
}

export interface ProductFilters {
  kind?: ProductKind;
  store_id?: string;
  q?: string;
  status?: "active" | "hidden";
}

export interface ProductCategoryBlock {
  kind: ProductKind;
  category: string;
  total: number;
  /** The category's first products (at most 5). */
  items: AdminProduct[];
}

const query = (params: Record<string, string | number | undefined>) => {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== "") q.set(key, String(value));
  const s = q.toString();
  return s ? `?${s}` : "";
};

/** One category's products, a page at a time. */
export async function listAdminProducts(
  { category, page = 1, perPage = 25, ...filters }: ProductFilters & { category: string; page?: number; perPage?: number },
): Promise<{ items: AdminProduct[]; total: number }> {
  return apiClient(`/admin/products${query({ category, ...filters, page, per_page: perPage })}`);
}

/** Every category with its total and first products. */
export async function getProductsOverview(
  filters: ProductFilters = {},
): Promise<{ total: number; categories: ProductCategoryBlock[] }> {
  return apiClient(`/admin/products/overview${query({ ...filters })}`);
}
