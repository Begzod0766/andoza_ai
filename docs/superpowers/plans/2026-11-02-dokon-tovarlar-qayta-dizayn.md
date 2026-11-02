# Do'kon "Tovarlar" paging and redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the admin products tab: the server lists materials and 3D models together, with exact paging and a per-category overview; the tab shows category blocks (5 rows + "Barchasini ko'rish"), numbered pages inside a category, aligned rows with a "⋯" menu, a labelled filter bar and a sticky category column.

**Architecture:** A new `admin_products` router builds one `UNION ALL` select over `materials` and `furniture` (same column shape) and serves `/admin/products` (LIMIT/OFFSET + count) and `/admin/products/overview` (`row_number()` per kind+category, ≤5, plus per-category totals). The frontend replaces `ProductsTab` internals with small units: `ProductRow`, `Pager`, and the tab itself.

**Tech Stack:** FastAPI + SQLAlchemy 2 (pytest, mocked session), React + TanStack Query (Vitest, Testing Library), Tailwind, lucide-react.

**Spec:** `docs/superpowers/specs/2026-11-02-dokon-tovarlar-qayta-dizayn-design.md`

## Global Constraints

- Admin only (`AdminUser`); no migration.
- Filters: `kind` (`materials` | `furniture` | omitted = both), `store_id`, `q` (case-insensitive on `name_uz`, `\` `%` `_` escaped), `status` (`active` | `hidden` | omitted).
- `/admin/products`: `category`, `page` ≥ 1, `per_page` 1–100 default **25**; sort `lower(name)`, `kind`, `id`; returns `{items, total}`.
- Overview: ≤ **5** rows per category, same sort; categories with no rows left out; `{total, categories:[{kind, category, total, items}]}`.
- `AdminProductOut`: `kind, id, name, store_id, store_name, category, price_uzs|null, unit|null, image_url|null, is_active`; furniture `image_url` = `absolute_media_url(request, thumbnail_key)`.
- `GET /admin/category-counts` and `getCategoryCounts` are removed.
- Copy uz / ru / en; theme tokens; page fits 375 px.

## Review Focus

1. Admin on page 3 of a category types a search that leaves 1 page → the list shows page 1, not an empty page 3 (Task 4 test).
2. Search text with `%`, `_` or `\` → literal in **both** union branches (Task 1 test).
3. A material category and a furniture category with the same label while kind = all → two entries told apart by a kind icon (Task 3 test).
4. A 3D model with no price and no shop → price "—", shop "—", the row still opens its dialog (Task 3 test).
5. Hiding a material from the "⋯" menu while Holat = Faol → the overview/list refetch (invalidate `["admin"]`) so the row leaves and totals drop (Task 3 test).

---

### Task 1: Backend products endpoints

**Files:**
- Create: `backend/app/schemas/admin_products.py`, `backend/app/routers/admin_products.py`
- Modify: `backend/app/main.py` (include router), `backend/app/routers/admin_catalog.py` (delete `category_counts`; keep `_name_like`, `_furniture_filters`; add `GET /admin/furniture/{id}`), `backend/app/routers/admin_materials.py` (add `GET /admin/materials/{id}`)
- Modify: `backend/tests/test_admin_lists.py` (delete `TestCategoryCounts` and the counts line in the admin-only test)
- Test: `backend/tests/test_admin_products.py` (mocked session as `tests/test_admin_lists.py`)

**Interfaces:**
- Produces:
  - `AdminProductOut`, `AdminProductsPage {items: list[AdminProductOut], total: int}`, `ProductCategoryBlock {kind, category, total, items}`, `ProductsOverview {total, categories: list[ProductCategoryBlock]}`.
  - `GET /admin/products?kind&store_id&q&status&category&page&per_page` → `AdminProductsPage`.
  - `GET /admin/products/overview?kind&store_id&q&status` → `ProductsOverview`.
  - `GET /admin/materials/{id}` → `AdminMaterialOut`, `GET /admin/furniture/{id}` → `FurnitureAdminOut`; 404 "Topilmadi"-style detail as the routers already use. The dialogs need the full objects, which `AdminProductOut` does not carry.
- Internal: `_union(kind, store_id, q, status, category=None) -> Select` with labelled columns `kind, id, name, store_id, store_name, category, price_uzs, unit, image (material image_url | furniture thumbnail_key), is_active`; `category` cast to `String` in both branches (materials use an Enum type); stores joined (outer for furniture). Image of a furniture row turns into a URL in Python.

- [ ] **Step 1: Write the failing tests**

```python
def test_list_unions_both_kinds_with_exact_paging(...)   # execute #1 = count → 30, #2 = rows; SQL has "UNION ALL", "LIMIT 25", "OFFSET 25" for page=2; total == 30
def test_list_filters_reach_both_branches(...)           # store_id, category, status=hidden → "is_active IS false" x2, q "50%_" → "%50\\%\\_%" twice + ESCAPE
def test_kind_limits_to_one_branch(...)                  # kind=furniture → no "materials" table in SQL
def test_rows_map_to_products(...)                       # material row → unit + image_url as stored; furniture row → unit None, image_url absolute, price None ok
def test_overview_groups_five_per_category(...)          # SQL has "row_number() OVER (PARTITION BY", "<= 5"; rows → blocks with totals from the count query; total = sum
def test_overview_leaves_out_empty_and_handles_no_rows(...)  # no rows → {"total": 0, "categories": []}
def test_products_endpoints_are_admin_only(...)          # 403 for both
def test_category_counts_is_gone(...)                    # GET /admin/category-counts → 404
def test_single_material_and_model(...)                  # 200 with the object; unknown id → 404; non-admin → 403
```

- [ ] **Step 2: Run** `cd backend && ~/.cache/andoza-bvenv/bin/python -m pytest tests/test_admin_products.py -q` — Expected: FAIL (404s / import errors).
- [ ] **Step 3: Implement** the schemas, `_union`, both routes (overview = one rows query with the window function filtered `rn <= 5`, one `GROUP BY kind, category` count query), register the router, delete `category_counts`.
- [ ] **Step 4: Run** `pytest tests/test_admin_products.py tests/test_admin_lists.py tests/test_admin_catalog.py tests/test_admin_materials.py tests/test_i18n_messages.py -q` — Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Admin API: products list and overview across materials and models"`.

### Task 2: Frontend API

**Files:**
- Create: `frontend/src/lib/api/adminProducts.ts` (export from `frontend/src/lib/api.ts`)
- Modify: `frontend/src/lib/api/admin.ts` (delete `CategoryCounts`, `getCategoryCounts`), `frontend/src/lib/api/__tests__/adminLists.test.ts` (drop its counts case)
- Test: `frontend/src/lib/api/__tests__/adminProducts.test.ts`

**Interfaces:**
- Produces:
  - `type ProductKind = "materials" | "furniture"`; `interface AdminProduct { kind; id; name; store_id: string|null; store_name: string|null; category; price_uzs: number|null; unit: string|null; image_url: string|null; is_active: boolean }`.
  - `interface ProductFilters { kind?: ProductKind; store_id?: string; q?: string; status?: "active" | "hidden" }`.
  - `listAdminProducts(f: ProductFilters & { category: string; page?: number; perPage?: number }): Promise<{ items: AdminProduct[]; total: number }>` → `/admin/products?…&page&per_page` (default 1, 25).
  - `getProductsOverview(f: ProductFilters = {}): Promise<{ total: number; categories: { kind: ProductKind; category: string; total: number; items: AdminProduct[] }[] }>` → `/admin/products/overview?…` (empty params left out).
  - `getAdminMaterial(id): Promise<AdminMaterial>` (in `adminMaterials.ts`) and `getAdminFurniture(id): Promise<AdminFurniture>` (in `admin.ts`).

- [ ] **Step 1: Write the failing tests** — URL for every param set; empty values dropped; overview without params → `/admin/products/overview`.
- [ ] **Step 2: Run** `cd frontend && npx vitest run src/lib/api/__tests__/adminProducts.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npx vitest run src/lib/api` — Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Admin API client: products list and overview"`.

### Task 3: Tab rebuilt — overview, rows, filter bar, category column

**Files:**
- Create: `frontend/src/pages/dokon/admin/ProductRow.tsx`
- Modify (rewrite): `frontend/src/pages/dokon/admin/ProductsTab.tsx`, `frontend/src/pages/dokon/admin/ProductsTab.test.tsx`
- Modify: locales `dokon.admin.products.*` (uz/ru/en)

**Interfaces:**
- Consumes: Task 2 functions. A row click fetches the full object (`getAdminMaterial` / `getAdminFurniture`), then opens `MaterialFormDialog` / `ModelEditDialog` with it; a failed fetch goes to `onError`. The "⋯" hide uses `updateAdminMaterial(id, { is_active })`.
- Produces: `ProductRow({ product, onOpen, onToggle, busy })`; `ProductsTab({ onError })` (same export as today).

- [ ] **Step 1: Write the failing tests** (`ProductsTab.test.tsx`, API mocked)

```ts
it('header shows Tovarlar (total) and the add menu opens both dialogs', ...)
it('blocks per category: heading label + total, ≤5 rows, "Barchasini ko\'rish (12)" only when total > 5', ...)
it('Barchasini ko\'rish selects that category', ...)                 // then listAdminProducts called with category
it('kind, status, shop and debounced search reach getProductsOverview', ...)
it('left column: Hamma kategoriyalar first with the total; category search filters entries', ...)
it('same label in both kinds shows two entries with kind icons', ...)          // Review Focus 3
it('a row click opens the material or the model dialog', ...)
it('a model with no price and no shop shows — and still opens', ...)          // Review Focus 4
it('⋯ on a material hides it and refetches the admin lists', ...)             // Review Focus 5: updateAdminMaterial(id,{is_active:false}); invalidate ["admin"]
it('only hidden rows carry the Yashirin pill; no Active pill', ...)
```

- [ ] **Step 2: Run** `npx vitest run src/pages/dokon/admin/ProductsTab.test.tsx` — Expected: FAIL.
- [ ] **Step 3: Implement** per spec "Header row", "Filter bar", "Left column", "List — Hamma kategoriyalar", "Row", "States", "Refreshing". uz copy: "Tovarlar ({{n}})", "Qo'shish", "Material", "3D model", "Turi:", "Holat:", "Kategoriya qidirish", "Barchasini ko'rish ({{n}})", "Yashirin", "Yashirish", "Ko'rsatish", "Tahrirlash", "Tovar topilmadi", "Amallar" (⋯ aria-label).
- [ ] **Step 4: Run** `npx vitest run src/pages/dokon` and `npx tsc --noEmit -p .` — Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Do'kon admin: products overview by category, aligned rows, filter bar"`.

### Task 4: Category pages and phone layout

**Files:**
- Create: `frontend/src/pages/dokon/admin/Pager.tsx`, `frontend/src/pages/dokon/admin/Pager.test.tsx`
- Modify: `frontend/src/pages/dokon/admin/ProductsTab.tsx`, `ProductsTab.test.tsx`, locales

**Interfaces:**
- Consumes: `listAdminProducts` (Task 2), `ProductRow` (Task 3).
- Produces: `Pager({ page, pages, onPage })` — renders nothing when `pages <= 1`; buttons for first, last, current ±1, "…" gaps, ‹ ›; `aria-current="page"` on the current.

- [ ] **Step 1: Write the failing tests**

```ts
// Pager.test.tsx
it('shows 1 … 4 5 6 … 9 on page 5 of 9, with aria-current on 5', ...)
it('hides itself for one page; ‹ disabled on 1, › disabled on the last', ...)
// ProductsTab.test.tsx
it('a category lists 25 a page and the pager loads page 2', ...)          // listAdminProducts({category, page: 2, ...})
it('a filter change or another category goes back to page 1', ...)       // Review Focus 1
it('Hamma kategoriyalar returns to the blocks', ...)
it('on a phone the price sits under the name (md:hidden / hidden md:block)', ...)
```

- [ ] **Step 2: Run** `npx vitest run src/pages/dokon/admin` — Expected: new tests FAIL.
- [ ] **Step 3: Implement**; scroll the list top into view on page change (`scrollIntoView({ block: "start" })`, guarded for jsdom).
- [ ] **Step 4: Run** `npx vitest run` and `npx tsc --noEmit -p .` — Expected: all PASS.
- [ ] **Step 5: Commit** `git commit -m "Do'kon admin: numbered pages inside a category, phone layout"`.
