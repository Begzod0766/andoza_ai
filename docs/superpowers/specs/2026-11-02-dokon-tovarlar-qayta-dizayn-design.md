# Do'kon admin "Tovarlar" tab: paging and redesign

**Date:** 2026-11-02 · **Status:** approved in chat · **Area:** `/dokon?tab=products` (`ProductsTab`), administrators only

## Why

The products tab (#127) loads 50 materials and 50 models and offers "Ko'proq ko'rsatish". With 699 products this misleads in three ways:

- The left column counts every product, but the group headers count only the loaded rows. For example, Chair shows 17 on the left and 5 in its header.
- Categories whose rows were not loaded are missing from the list entirely (Bed 14).
- The status filter only looks at the loaded rows.

The design critique also found visual problems:

- The price column does not line up, because some rows have a "Hide" button and others do not.
- Every row carries a green "Active" pill.
- There are two unlabelled "All" chips.
- The add buttons sit in the filter row.
- The category column scrolls away with the page.

**Success means:**

- Every count on the page is exact.
- Every category is visible from "Hamma kategoriyalar".
- An admin reaches any product in a few clicks.
- Rows are aligned columns with one action menu.

## Decisions (from the brainstorm)

- **Hamma kategoriyalar:** each category is shown with its first 5 products and a "Barchasini ko'rish (N)" button. Inside one category the list is split into numbered pages.
- **Rows:** clicking a row opens the edit dialog. A "⋯" menu at the end of the row holds the other actions.
- **Data:** two new admin endpoints serve materials and furniture as one list. Filtering and paging happen on the server, not in the browser.

## Backend (no migration)

All endpoints below are admin only (`AdminUser`).

**Common query parameters:**

| Parameter | Values | Notes |
|---|---|---|
| `kind` | `materials` · `furniture` · omitted | Omitted means both kinds |
| `store_id` | uuid | |
| `q` | text | Case-insensitive search on `name_uz`; `\`, `%`, `_` are escaped as today |
| `status` | `active` · `hidden` · omitted | Matches `is_active` |

**Shared row shape `AdminProductOut`:**

```
{ kind: "materials" | "furniture", id, name, store_id, store_name, category,
  price_uzs (nullable), unit (nullable; materials only), image_url (nullable), is_active }
```

- For a material, `image_url` is the material's image.
- For furniture, `image_url` is the absolute thumbnail URL, built the same way as `_furniture_out`.

**`GET /admin/products`**

- Takes the common parameters, plus `category`, `page` (≥1) and `per_page` (1–100, default 25).
- Returns `{items: AdminProductOut[], total}`.
- Rows are sorted by `name` (case-insensitive), then `kind`, then `id`.
- Materials and furniture are combined as one UNION ALL query, so paging and `total` are exact across both kinds.

**`GET /admin/products/overview`**

- Takes the common parameters only.
- Returns `{total, categories: [{kind, category, total, items: AdminProductOut[≤5]}]}`.
- Categories are listed in a stable order: `kind`, then `category`. The client orders them by label.
- Categories with no matching rows are left out.
- The first 5 rows of each category use the same sort as the list. They are picked with a window function: `row_number() over (partition by kind, category order by …)`.

**Removed:** `GET /admin/category-counts` and the client function `getCategoryCounts`. The overview supersedes both. The `q` parameter on `/admin/furniture` and `per_page` on materials stay, because they are harmless.

## Frontend: `ProductsTab` rebuilt

**Header row**

- The title "Tovarlar (699)", taken from the overview `total`.
- On the right, "+ Qo'shish ▾", a menu with two items:
  - "Material" opens `MaterialFormDialog` (new).
  - "3D model" opens `ModelFormDialog`.

**Filter bar**

- A wide search field with a 300 ms debounce, then the shop select.
- Two labelled segmented controls:
  - **Turi:** Hammasi / Materiallar / Mebel.
  - **Holat:** Hammasi / Faol / Yashirin.
- The status filter is now applied by the server.

**Left column** (`lg` and up)

- Sticky (`top`), with its own scroll.
- A small category search filters the list on the client, by label.
- The first entry is "Hamma kategoriyalar N". Each category follows with its total from the overview.
- If both kinds are shown and two categories share a label, a kind icon tells them apart.
- On a phone the column becomes a horizontal chip row (as today) and the category search is hidden.

**List, "Hamma kategoriyalar" selected**

- One block per overview category, ordered by label.
- Each block has a heading (label and total), up to 5 rows, and "Barchasini ko'rish (N) →" when the total is above 5. The button selects that category.

**List, one category selected**

- Rows come from `/admin/products` with `category`, 25 to a page.
- The pager reads "‹ 1 2 3 … 9 ›". It shows the current page ±1, the first page and the last page, and is hidden when there is only one page.
- Any filter change, or a change of category, goes back to page 1. The scroll position moves to the list top.

**Row** (an `li` holding one button for the whole row, plus a menu button)

- Thumbnail 44 px, or a category-letter placeholder when there is no image. A small kind badge (box = model, layers = material) sits in the corner.
- Name, up to 2 lines. The shop goes on the second line, muted.
- Price, right-aligned in a fixed-width column (`md` and up). Materials show `/ unit`. Furniture without a price shows "—".
- A "Yashirin" pill, shown only for hidden products.
- A "⋯" button that opens a menu:
  - **Materials:** Yashirish / Ko'rsatish (`updateAdminMaterial`).
  - **Models:** the edit dialog holds its active switch, so the menu shows only "Tahrirlash".
- Clicking the row opens `MaterialFormDialog` or `ModelEditDialog`.
- On a phone the price moves under the name, and the row keeps the thumbnail, the text and "⋯".

**States**

- **Loading:** skeleton rows.
- **Empty:** "Tovar topilmadi".
- **Error:** the existing "Yuklab bo'lmadi".

**Refreshing**

- After a save, hide or add, invalidate `["admin"]` and `["materials"]`.
- The open page and category stay as they are.

**Copy:** all text in uz / ru / en.

## Out of scope

- Bulk actions.
- Sorting by price.
- Editing inside the row.
- Deleting from this list. The model dialog already deletes.
- Changes to other tabs.

## Testing

**Backend**

- Both endpoints honour every filter.
- `total` and paging are exact across materials and furniture together.
- The overview returns at most 5 rows per category, with the right totals, and leaves out empty categories.
- `%` and `_` in the search are matched as letters.
- A non-admin gets 403.

**Frontend**

- The "Hamma kategoriyalar" blocks show their heading totals and the "Barchasini ko'rish" button.
- A category goes into page mode: the pager calls the right page, and a filter change resets to page 1.
- Status, kind and search reach both requests.
- A row click opens the right dialog. The menu hides a material.
- The add menu opens both dialogs.
- The category search filters the left column.
- The phone layout keeps the page inside 375 px.

**Prod:** check at desktop and 375 px width, with screenshots.
