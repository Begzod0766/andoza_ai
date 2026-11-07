# Do'kon admin: tabs, filters, products by category — design

**Date:** 2026-11-02 · **Status:** approved in chat · **Area:** `/dokon` as an administrator (`AdminCatalogPanel`)

## Why

An administrator's `/dokon` is one long column: the moderation queue, every order as a large card listing all its items, the materials list, then the shops and 3D models. Nothing is grouped, there is no search, and products cannot be narrowed by category, so the page reads as noise. The buyer's `/dokon` is not touched.

Success: an administrator finds an order, a product or a shop in a few clicks, sees products grouped by category with counts, and each area lives on its own tab.

## Decisions (from the brainstorm)

- Tabs inside `/dokon` (not separate routes), the tab kept in the URL (`?tab=`).
- One "Tovarlar" tab for materials **and** 3D furniture models together.
- Orders as a compact table whose rows open.

## Shell

`AdminCatalogPanel` becomes a tab bar plus one panel:

| Tab | `?tab=` | Badge |
|---|---|---|
| Buyurtmalar | `orders` | orders with status `accepted` |
| Tovarlar | `products` | — |
| Do'konlar | `stores` | — |
| Moderatsiya | `moderation` | pending shop applications + models |

Default when `?tab` is absent or unknown: `moderation` if anything is pending, else `orders`. Switching a tab replaces the query string (no history entry per click). A shop's profile (`StoreProfile`) opens inside the Do'konlar tab as today.

## Buyurtmalar tab

- Filters: status chips (existing statuses + "Hammasi"), shop select (from `listAdminStores`), period (`Bugun` / `7 kun` / `30 kun` / `Hammasi`), search box (order number prefix or phone digits), debounced 300 ms.
- Table columns: `№` (first 8 of the id, upper case) · Do'kon · Telefon · Sana · Tovarlar (count) · Summa · Holat (chip). Rows are buttons; one opens at a time showing address, payment method, the item lines (name × qty, sum) and the existing status actions (`setAdminOrderStatus`, cancel with reason).
- Paging: 50 per page, "Ko'proq ko'rsatish" appends the next page.
- Phone width: the table becomes stacked rows (№ · Do'kon · Summa · Holat; the rest inside the opened row).

## Tovarlar tab

- Top bar: kind switch `Hammasi / Materiallar / Mebel`, shop select, search (debounced), status `Hammasi / Faol / Yashirin`.
- Left column: categories with counts for the current kind/shop/search (from the counts endpoint), "Hamma kategoriyalar" first; on a phone it becomes a horizontal chip row.
- List: rows with thumbnail, name, shop, category, price (`formatUZS`, materials per unit), status pill, "Tahrirlash" (opens the existing `MaterialFormDialog` / `ModelEditDialog`). With "Hamma kategoriyalar" the rows are grouped under category headings; with one category, a flat list.
- Data: materials from `listAdminMaterials({category, store_id, q})`, furniture from `listAdminFurniture({category, store_id, q})`; 50 per kind per page, "Ko'proq ko'rsatish". Status filter applies client-side on the loaded rows (`is_active`).
- Adding a material or a model stays where it is today (buttons in the tab header open the existing dialogs).

## Do'konlar tab

The existing `CatalogOverview` shop grid with a search box (name or district, client-side) and the existing shop creation; a click opens `StoreProfile`.

## Moderatsiya tab

The existing `ModerationQueue`, unchanged.

## Backend

- `GET /admin/orders`: new optional `store_id`, `since` (ISO datetime, `created_at >= since`), `q` (order id prefix, case-insensitive, or digits matched inside `phone`).
- `GET /admin/catalog/furniture`: new optional `q` (name, case-insensitive, `%`/`_` escaped as materials do).
- New `GET /admin/catalog/category-counts?store_id=&q=` → `{ "materials": {category: n}, "furniture": {category: n} }`, admin only.
- No schema change, no migration.

## Out of scope

Bulk edit, CSV export, order analytics, changes to the buyer's shop.

## Testing

- Backend: each new filter narrows the list; counts honour shop and search; non-admin → 403.
- Frontend: default tab rules and `?tab=` round trip; order filters call the API with the right params; a row opens and shows items and actions; Tovarlar counts, grouping under headings, category click narrows, search debounced; Do'konlar search; existing admin tests keep passing.
- Prod check with a screenshot after deploy.
