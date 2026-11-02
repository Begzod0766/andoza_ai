import { apiClient } from "./client";
import { getMaterials, type Material } from "./materials";
import { EMPTY_PRICE_BOOK } from "@/features/mebel/engine";
import type { FurnitureProject, PriceBook } from "@/features/mebel/engine";

/** The /mebel mini-app's storage: projects and the workshop's price book. */
export interface MebelProjectSummary {
  id: string;
  name: string;
  updated_at: string;
  /** Counted from the stored project, so two of one name can be told apart. */
  cabinets?: number;
  free_parts?: number;
  cut_at?: string | null;
}

export interface MebelProject {
  id: string;
  name: string;
  data: FurnitureProject;
  /** "Kesildi": when the job was cut and its offcuts moved through the store. */
  cut_at?: string | null;
}

/** An offcut entered by hand or left by a job's layout. */
export interface OffcutIn {
  material: "board" | "back" | "facade";
  materialId: string | null;
  thickness: number;
  length: number;
  width: number;
}

export interface MebelOffcut extends OffcutIn {
  id: string;
  source_project_id: string | null;
  created_at: string;
}

const CATALOG_PAGE = 100; // the server's largest page
const CATALOG_MAX_PAGES = 5;

/** Every shop product of one category, page by page (up to 500), for the
 *  material pickers and their prices. */
export async function getCatalogMaterials(category: string): Promise<Material[]> {
  const all: Material[] = [];
  for (let page = 1; page <= CATALOG_MAX_PAGES; page++) {
    const items = await getMaterials({ category, per_page: CATALOG_PAGE, page });
    all.push(...items);
    if (items.length < CATALOG_PAGE) break;
  }
  return all;
}

export function listMebelProjects(): Promise<MebelProjectSummary[]> {
  return apiClient<MebelProjectSummary[]>("/mebel/projects");
}

export function getMebelProject(id: string): Promise<MebelProject> {
  return apiClient<MebelProject>(`/mebel/projects/${encodeURIComponent(id)}`);
}

export function createMebelProject(name: string, data: FurnitureProject): Promise<MebelProject> {
  return apiClient<MebelProject>("/mebel/projects", { method: "POST", body: JSON.stringify({ name, data }) });
}

export function saveMebelProject(id: string, name: string, data: FurnitureProject): Promise<MebelProject> {
  return apiClient<MebelProject>(`/mebel/projects/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify({ name, data }),
  });
}

export async function deleteMebelProject(id: string): Promise<void> {
  await apiClient<void>(`/mebel/projects/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/** The saved price book over the empty one, so a field added later has a value. */
export async function getPriceBook(): Promise<PriceBook> {
  const saved = await apiClient<Partial<PriceBook>>("/mebel/price-book");
  return {
    ...EMPTY_PRICE_BOOK,
    ...saved,
    bandingPerMeter: { ...EMPTY_PRICE_BOOK.bandingPerMeter, ...saved.bandingPerMeter },
    hardware: { ...EMPTY_PRICE_BOOK.hardware, ...saved.hardware },
  };
}

export function savePriceBook(pb: PriceBook): Promise<PriceBook> {
  return apiClient<PriceBook>("/mebel/price-book", { method: "PUT", body: JSON.stringify({ data: pb }) });
}

/** A cabinet the AI proposes; sizes already checked by the server. */
export interface MebelSuggestedCabinet {
  type: "base" | "wall" | "tall";
  width: number;
  height: number;
  depth: number;
  shelves: number;
  doors: 0 | 1 | 2 | null;
  drawers: number;
}

export interface MebelSuggestion {
  cabinets: MebelSuggestedCabinet[];
  facade: "ldsp" | "mdf" | "none" | null;
  questions: string[];
  /** Proposed cabinets the server left out, with why. */
  dropped: string[];
  /** Rows whose widths miss the length the user gave. */
  warnings?: string[];
}

export function suggestMebelCabinets(text: string): Promise<MebelSuggestion> {
  return apiClient<MebelSuggestion>("/mebel/ai/suggest", { method: "POST", body: JSON.stringify({ text }) });
}

export function listOffcuts(): Promise<MebelOffcut[]> {
  return apiClient<MebelOffcut[]>("/mebel/offcuts");
}

export function addOffcut(body: OffcutIn): Promise<MebelOffcut> {
  return apiClient<MebelOffcut>("/mebel/offcuts", { method: "POST", body: JSON.stringify(body) });
}

export async function deleteOffcut(id: string): Promise<void> {
  await apiClient<void>(`/mebel/offcuts/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/** "Kesildi": the store offcuts the layout used leave, the offcuts it leaves arrive. */
export function cutMebelProject(id: string, body: { used: string[]; produced: OffcutIn[] }): Promise<MebelProject> {
  return apiClient<MebelProject>(`/mebel/projects/${encodeURIComponent(id)}/cut`, { method: "POST", body: JSON.stringify(body) });
}
