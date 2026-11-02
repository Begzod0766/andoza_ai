# Do'kon admin tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the administrator's `/dokon` from one long column into four tabs — Buyurtmalar, Tovarlar, Do'konlar, Moderatsiya — with filters, search, and products grouped by category.

**Architecture:** Three backend list filters and one counts endpoint (no migration). `AdminCatalogPanel` becomes a tab shell reading `?tab=`; new `OrdersTab` and `ProductsTab` components replace the stacked `AdminOrders`/`AdminMaterials`; `CatalogOverview` gains a search box; `ModerationQueue` is reused as is.

**Tech Stack:** FastAPI + SQLAlchemy (pytest), React + TanStack Query + react-router (Vitest, Testing Library).

**Spec:** `docs/superpowers/specs/2026-11-02-dokon-admin-tablar-design.md`

## Global Constraints

- Tabs and `?tab=` values: `orders`, `products`, `stores`, `moderation`; default `moderation` when anything is pending, else `orders`; switching uses `setSearchParams(..., { replace: true })`.
- Orders: 50 per page; periods `Bugun` (since start of today, local), `7 kun`, `30 kun`, `Hammasi`; search debounced 300 ms; `№` = first 8 chars of the id, upper case.
- Products: 50 per kind per page; status filter `Hammasi / Faol / Yashirin` on `is_active`, client-side.
- All new endpoints/filters admin-only (existing `AdminUser` dependency).
- Paths follow the real router prefix `/admin` (`admin_catalog.py`): `/admin/furniture` and `/admin/category-counts` — the spec's `/admin/catalog/...` names the same endpoints.
- The buyer's `/dokon` is unchanged. UI copy uz / ru / en; theme tokens (`text-ink`, `bg-card`…) as on other admin screens; untranslated-text test stays green.

## Review Focus

1. `?tab=` holds an unknown value (old link, typo) → falls back to the default tab, no blank page (Task 3 test).
2. Search text with `%`, `_` or a backslash → matched literally, not as a wildcard (Task 1 test for furniture `q`, orders `q`).
3. An order search of digits only matches a phone; a hex-looking value also matches an id prefix (Task 1 test).
4. Category counts when a shop has no products → empty maps, the left column shows only "Hamma kategoriyalar" (Task 1 + Task 4 tests).
5. Opening an order row then changing a filter → the open row closes if the order is no longer listed (Task 3 test).

---

### Task 1: Backend filters and category counts

**Files:**
- Modify: `backend/app/routers/admin_orders.py` (`list_orders`: `store_id`, `since`, `q`)
- Modify: `backend/app/routers/admin_catalog.py` (`list_furniture_admin`: `q`; new `category_counts`)
- Test: `backend/tests/test_admin_lists.py` (new; stub the DB like `tests/test_mebel.py`, or use the app's test DB fixture if `test_admin_catalog.py` uses one — follow that file)

**Interfaces:**
- Produces:
  - `GET /admin/orders?status&store_id&since&q&page&per_page`; `q`: if it is 1–8 hex chars also matches `cast(Order.id, String).ilike(q + '%')`; digits (spaces/`+` stripped) match `Order.phone.ilike('%' + digits + '%')`; combined with OR.
  - `GET /admin/furniture?...&q` → `Furniture.name.ilike('%' + escaped + '%', escape='\\')` (same escaping as `admin_materials.list_materials`).
  - `GET /admin/category-counts?store_id&q` → `{"materials": {category: int}, "furniture": {category: int}}` via `GROUP BY category`; materials filtered by `store_id`/`q` like `list_materials`, furniture by `store_id`/`q` above.

- [ ] **Step 1: Write the failing tests**

```python
def test_orders_filter_by_store_since_and_query(...): ...   # store_id narrows; since excludes older; q "9999cb" matches id prefix; q "90 123" matches phone digits
def test_order_query_with_wildcards_is_literal(...): ...    # q "%" matches nothing special
def test_furniture_search_by_name(...): ...                 # q "divan" finds "Divan Oslo", not "Stol"; "_" literal
def test_category_counts(...): ...                          # {"materials": {"laminat": 2}, "furniture": {"divan": 1}}; store_id with no products → {} / {}
def test_new_endpoints_are_admin_only(...): ...             # non-admin → 403
```

- [ ] **Step 2: Run** `cd backend && pytest tests/test_admin_lists.py -q` — Expected: FAIL.
- [ ] **Step 3: Implement** as in Interfaces.
- [ ] **Step 4: Run** `pytest tests/test_admin_lists.py tests/test_admin_catalog.py tests/test_admin_materials.py tests/test_order_cancellation.py -q` — Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Admin API: order and furniture filters, category counts"`.

### Task 2: Frontend API

**Files:**
- Modify: `frontend/src/lib/api/adminOrders.ts`, `frontend/src/lib/api/admin.ts`, `frontend/src/lib/api/adminMaterials.ts` (only if a param is missing)
- Test: `frontend/src/lib/api/__tests__/adminLists.test.ts`

**Interfaces:**
- Produces:
  - `listAdminOrders(params: { status?: OrderStatus; store_id?: string; since?: string; q?: string; page?: number; perPage?: number } = {}): Promise<AdminOrder[]>` — **object** parameter; update existing callers.
  - `listAdminFurniture(params: { store_id?; category?; room_type?; q? })`.
  - `getCategoryCounts(params: { store_id?: string; q?: string } = {}): Promise<{ materials: Record<string, number>; furniture: Record<string, number> }>`.

- [ ] **Step 1: Write the failing tests** — each function builds the expected URL (mock `apiClient`/`fetch` as the existing `adminMaterials.test.ts` does): orders with all params → `/admin/orders?page=1&per_page=50&status=accepted&store_id=s1&since=…&q=abc`; furniture `q`; counts `/admin/category-counts?store_id=s1`.
- [ ] **Step 2: Run** `cd frontend && npx vitest run src/lib/api/__tests__/adminLists.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement**; update `AdminOrders.tsx` call sites to the object form.
- [ ] **Step 4: Run** `npx vitest run src/lib/api src/pages/dokon` — Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Admin API client: filters and category counts"`.

### Task 3: Tab shell and Buyurtmalar tab

**Files:**
- Modify: `frontend/src/pages/dokon/AdminCatalogPanel.tsx` (tab shell)
- Create: `frontend/src/pages/dokon/admin/OrdersTab.tsx`, `frontend/src/pages/dokon/admin/OrdersTab.test.tsx`
- Modify: `frontend/src/pages/dokon/admin/AdminOrders.tsx` → reuse its status-action buttons by extracting `OrderActions({ order, onChanged, onError })` into `admin/OrderActions.tsx`; delete what `OrdersTab` replaces
- Modify: locales (`dokon.admin.tabs.*`, `dokon.admin.orders.*`)
- Test: `frontend/src/pages/dokon/AdminCatalogPanel.test.tsx` (new)

**Interfaces:**
- Consumes: Task 2 functions; `getPendingQueue` (badge count and default tab).
- Produces: `AdminCatalogPanel` with `role="tablist"` buttons (`role="tab"`, `aria-selected`) and badges; `OrdersTab({ onError })`.

- [ ] **Step 1: Write the failing tests**

```ts
it('opens Moderatsiya when something is pending, else Buyurtmalar', ...)
it('?tab=products opens Tovarlar; an unknown tab falls back to the default', ...)
it('switching a tab writes ?tab= without a history entry', ...)       // MemoryRouter + location probe
it('orders: filters call the API with status, shop, since and q (debounced)', ...)   // vi.useFakeTimers for 300 ms
it('orders: a row opens with address, items and actions; one at a time', ...)
it('orders: an open row closes when a filter drops its order', ...)
it('orders: Ko\'proq ko\'rsatish loads page 2 and appends', ...)
```

- [ ] **Step 2: Run** `npx vitest run src/pages/dokon` — Expected: new tests FAIL.
- [ ] **Step 3: Implement** (uz: tabs "Buyurtmalar", "Tovarlar", "Do'konlar", "Moderatsiya"; periods "Bugun", "7 kun", "30 kun", "Hammasi"; search placeholder "Raqam yoki telefon"; columns "№", "Do'kon", "Telefon", "Sana", "Tovarlar", "Summa", "Holat"; "Ko'proq ko'rsatish"; ru/en).
- [ ] **Step 4: Run** `npx vitest run src/pages/dokon` — Expected: PASS (existing admin tests updated only where they asserted the stacked layout).
- [ ] **Step 5: Commit** `git commit -m "Do'kon admin: tabs and an orders table with filters"`.

### Task 4: Tovarlar and Do'konlar tabs

**Files:**
- Create: `frontend/src/pages/dokon/admin/ProductsTab.tsx`, `frontend/src/pages/dokon/admin/ProductsTab.test.tsx`
- Modify: `frontend/src/pages/dokon/admin/CatalogOverview.tsx` (search box over the shop grid)
- Modify: `AdminCatalogPanel.tsx` (render `ProductsTab`, `CatalogOverview`/`StoreProfile`, `ModerationQueue` per tab); remove the stacked `AdminMaterials` from the panel (its dialogs are reused by `ProductsTab`)
- Modify: locales (`dokon.admin.products.*`)

**Interfaces:**
- Consumes: `listAdminMaterials`, `listAdminFurniture`, `getCategoryCounts`, `listAdminStores`, existing `MaterialFormDialog`, `ModelEditDialog`, category label helpers in `admin/materialLabels.ts` / `admin/labels.ts`.
- Produces: `ProductsTab({ onError })`.

- [ ] **Step 1: Write the failing tests**

```ts
it('shows categories with counts and "Hamma kategoriyalar" first', ...)
it('with all categories, rows are grouped under category headings', ...)
it('a category click narrows the list and the API call', ...)
it('kind switch Materiallar / Mebel shows only that kind', ...)
it('search is debounced and sent as q to both lists and the counts', ...)
it('status Yashirin keeps only inactive rows', ...)
it('Tahrirlash opens the material or model dialog', ...)
it('a shop with no products shows only "Hamma kategoriyalar" and an empty state', ...)
it('Do\'konlar: search filters the shop grid by name or district', ...)
```

- [ ] **Step 2: Run** `npx vitest run src/pages/dokon` — Expected: new tests FAIL.
- [ ] **Step 3: Implement** (uz: kind "Hammasi" / "Materiallar" / "Mebel", status "Hammasi" / "Faol" / "Yashirin", "Hamma kategoriyalar", search "Nomi bo'yicha qidirish", empty "Tovar topilmadi", shop search "Do'kon yoki tuman"; ru/en).
- [ ] **Step 4: Run** `npx vitest run` and `npx tsc --noEmit -p .` — Expected: all PASS.
- [ ] **Step 5: Commit** `git commit -m "Do'kon admin: products by category, shop search"`.
