import { apiClient } from "./client";
import type { OrderLine, OrderStatus } from "./orders";

/** An order as the administrators see it. */
export interface AdminOrder {
  id: string;
  user_id: string;
  store_id: string | null;
  store_name: string | null;
  dealer_name: string;
  total_uzs: number;
  status: OrderStatus | string;
  delivery_address: string | null;
  phone: string | null;
  payment_method: string | null;
  cancelled_by: string | null;
  cancel_reason: string | null;
  created_at: string;
  lines: OrderLine[];
}

export interface AdminOrderFilters {
  status?: OrderStatus;
  store_id?: string;
  /** ISO datetime: orders placed at or after it. */
  since?: string;
  /** Order number (the start of its id) or phone digits. */
  q?: string;
  page?: number;
  perPage?: number;
}

export async function listAdminOrders({ page = 1, perPage = 50, ...filters }: AdminOrderFilters = {}): Promise<AdminOrder[]> {
  const q = new URLSearchParams({ page: String(page), per_page: String(perPage) });
  for (const [key, value] of Object.entries(filters)) if (value) q.set(key, value);
  return apiClient<AdminOrder[]>(`/admin/orders?${q}`);
}

/** Move an order to its next stage, or cancel it (with a reason). */
export async function setAdminOrderStatus(id: string, status: OrderStatus, reason?: string): Promise<AdminOrder> {
  return apiClient<AdminOrder>(`/admin/orders/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status, ...(reason ? { reason } : {}) }),
  });
}
