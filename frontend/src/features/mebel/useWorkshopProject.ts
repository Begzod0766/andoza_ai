import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import i18n from "@/i18n";
import { getCatalogMaterials, getPublicMebelProject } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import { computeProject, EMPTY_PRICE_BOOK, normalizeProject } from "@/features/mebel/engine";
import type { FurnitureProject, Part, Result } from "@/features/mebel/engine";
import { CATALOG_CATEGORIES } from "./useMebelProject";

export type WorkshopStatus = "loading" | "gone" | "error" | "broken" | "ready";

export interface WorkshopProject {
  status: WorkshopStatus;
  name?: string;
  project?: FurnitureProject;
  result?: Result;
  /** The part's catalogue material name, else its generic kind ("LDSP"). */
  materialName(p: Part): string;
  retry(): void;
}

/**
 * The project a part label's QR opens, read by its workshop token with no
 * account, and its parts recomputed by the same engine as the editor. No
 * price book and no offcut stock: part sizes, bands and holes depend on neither.
 *
 * `gone` is only a 404 (a wrong or revoked token). A rate limit or a network
 * failure is `error`, which can be retried. A stored project the engine cannot
 * compute is `broken`: fetching it again gives the same data, only its owner can fix it.
 */
export function useWorkshopProject(token: string): WorkshopProject {
  const query = useQuery({
    queryKey: ["mebel", "workshop", token],
    queryFn: () => getPublicMebelProject(token),
    retry: false,
    staleTime: 60_000,
  });
  // Only for material names; the catalogue is public, and the page works without it.
  const catalogQueries = useQueries({
    queries: CATALOG_CATEGORIES.map((category) => ({
      queryKey: ["mebel", "catalog", category],
      queryFn: () => getCatalogMaterials(category),
      staleTime: 10 * 60_000,
      retry: false,
    })),
  });
  const catalogKey = catalogQueries.map((q) => q.dataUpdatedAt).join("|");
  const names = useMemo(() => {
    const out: Record<string, string> = {};
    for (const q of catalogQueries) {
      for (const m of q.data ?? []) out[m.id] = m.store_name ? `${m.name_uz} · ${m.store_name}` : m.name_uz;
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- catalogKey stands for the lists
  }, [catalogKey]);

  const computed = useMemo(() => {
    if (!query.data) return null;
    try {
      const project = normalizeProject({ ...query.data.data, name: query.data.name });
      const result = computeProject(project, EMPTY_PRICE_BOOK, {}, []);
      return result.errors.length > 0 ? "bad" : { project, result };
    } catch {
      // A stored project the engine cannot read (missing keys, wrong shapes).
      return "bad";
    }
  }, [query.data]);

  const materialName = (p: Part) =>
    (p.materialId ? names[p.materialId] : undefined) ?? i18n.t(`mebel.material.${p.material}`);
  const retry = () => void query.refetch();

  if (query.isPending || (query.isFetching && !query.data)) return { status: "loading", materialName, retry };
  if (query.isError) {
    const gone = query.error instanceof ApiError && query.error.status === 404;
    return { status: gone ? "gone" : "error", materialName, retry };
  }
  if (computed === null) return { status: "error", materialName, retry };
  if (computed === "bad") return { status: "broken", name: query.data.name, materialName, retry };
  return { status: "ready", name: query.data.name, project: computed.project, result: computed.result, materialName, retry };
}
