import { apiClient } from "./client";

/** One number from the three norm files, as the admin panel shows it (spec 2026-11-15). */
export interface AdminNorm {
  file: "plumbing" | "tile" | "bathroom_extras";
  path: string;
  label: string;
  unit: string;
  group: string;
  default: number;
  value: number;
  overridden: boolean;
  updated_at: string | null;
}

export interface AdminNormChange {
  file: string;
  path: string;
  label: string;
  /** Null: it was the file's own value. */
  old_value: number | null;
  /** Null: put back to the file's own value. */
  new_value: number | null;
  user_id: string | null;
  created_at: string;
}

export const listAdminNorms = () => apiClient<{ entries: AdminNorm[] }>("/admin/norms");

export const listAdminNormLog = (limit = 50) => apiClient<{ items: AdminNormChange[] }>(`/admin/norms/log?limit=${limit}`);

export const setAdminNorm = (file: string, path: string, value: number) =>
  apiClient<AdminNorm>(`/admin/norms/${file}/${encodeURIComponent(path)}`, { method: "PUT", body: JSON.stringify({ value }) });

export const resetAdminNorm = (file: string, path: string) =>
  apiClient<AdminNorm>(`/admin/norms/${file}/${encodeURIComponent(path)}`, { method: "DELETE" });
