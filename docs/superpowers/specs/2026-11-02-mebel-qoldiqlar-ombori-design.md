# Mebel: offcut stock (qoldiqlar ombori) — design

**Date:** 2026-11-02 · **Status:** approved in chat (approach A) · **Area:** `/mebel`, `/mebel/:id`, new `/mebel/qoldiqlar`

## Why

Chipboard is the biggest cost in a cabinet job, and every job leaves usable pieces. The cutting layout already computes them (`NestedSheet.offcuts`, at least 200 × 200 mm) but forgets them. Workshops keep these pieces and cut the next job's small parts from them; Astra-Raskroy and similar tools keep an offcut store for exactly this. Without one, every job is priced as if bought from whole sheets.

Success: a workshop keeps a store of its offcuts — saved from a job's layout in one step or entered by hand — and the next job's layout uses matching offcuts before whole sheets, buying fewer sheets.

## Decisions (from the brainstorm)

- Offcuts enter the store **both** from a job's layout and by hand.
- The layout uses the store **automatically**, behind a per-project switch "Qoldiqlardan foydalanish".
- The store changes **only** when the user presses **"Kesildi"** on a job: the offcuts it used leave, the offcuts it leaves (≥ 200 × 200) arrive.
- Approach A: a server table + API. Rejected: a JSON blob beside the price book (two tabs overwrite each other; "Kesildi" cannot be atomic); per-project offcuts (no reuse across jobs, which is the point).

## Data

Table `mebel_offcuts` (migration `1786000047_mebel_offcuts`):

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| user_id | uuid fk users, indexed | owner; every query filters by it |
| material | text | `board` \| `back` \| `facade` |
| material_id | text null | catalogue item, null = none chosen |
| thickness | int | mm |
| length, width | int | mm, whole, 200–5000, length ≥ width not required |
| source_project_id | uuid null | the job it came from (fk set null on delete) |
| created_at | timestamptz | |

At most **500** offcuts per user (422 beyond). `furniture_projects` gains `cut_at timestamptz null`.

## API (`/api/v1/mebel`)

- `GET /offcuts` → the caller's offcuts, newest first.
- `POST /offcuts` `{material, materialId, thickness, length, width}` → 201 (hand entry).
- `DELETE /offcuts/{id}` → 204; another user's or a missing id → 404.
- `POST /projects/{id}/cut` `{used: uuid[], produced: OffcutIn[]}` → in **one transaction**: every `used` id must exist and belong to the caller, else **409** "Qoldiqlar o'zgargan — raskroyni yangilang" and nothing changes; delete `used`; insert `produced` with `source_project_id = id`; set `cut_at = now()`. A project already cut → 409. Returns the project.
- `ProjectOut` gains `cut_at`.

## Engine (cutting layout)

- `ConstructionDefaults.useOffcuts?: boolean` (default false; old projects false).
- `nestSheets(groups, sheet, opts, stock?: StockPiece[])` where `StockPiece = { id, material, materialId, thickness, length, width }`. For each board (material + materialId + thickness): matching stock pieces are filled **first**, largest first, each as its own bin with **trim 0** (a sawn edge) and the usual kerf; parts that fit no stock piece go to whole sheets as today. A stock piece that receives no part is not used.
- `NestedSheet` gains `stockId?: string` and `size: { length; width }` (the bin's size; a whole sheet's size for whole sheets). `NestResult.sheets` lists stock bins first. `utilization` per bin uses its own area.
- `computeProject(project, prices, catalog, stock = [])` passes `stock` only when `defaults.useOffcuts`.
- BOM: the sheet line counts **whole sheets only** (stock is free); the cutting-service line counts whole sheets **and** stock bins.
- Offcuts to save on "Kesildi": every bin's `offcuts` (already ≥ 200 × 200), with the bin's material, materialId and thickness.

## UI

- **Project page:** in "Konstruksiya", a checkbox "Qoldiqlardan foydalanish (omborda N ta)". Stock bins are labelled "Qoldiq · 800×600" in the layout, the PDF sheet pages and the BOM summary. Header button **"Kesildi"** (confirm dialog: "N ta qoldiq ombordan chiqadi, M ta yangi qoldiq qo'shiladi"); after success the header shows "Kesilgan: <date>" and the button is gone; a 409 shows its message and refetches the stock.
- **Store page `/mebel/qoldiqlar`:** linked from the `/mebel` list header ("Qoldiqlar ombori"). Grouped by material and thickness: rows `800 × 600 · <material name> · <source project or "qo'lda">`, delete with confirm; a form to add one by hand (material, catalogue material, thickness, length, width). Empty state text.
- uz / ru / en strings.

## Out of scope

Reserving offcuts while a job is only planned; non-rectangular offcuts; offcuts of MDF door orders; sharing a store between users.

## Testing

- Engine: a part fitting a stock piece goes there and whole sheets drop; a stock piece of another material/thickness/materialId is ignored; a part too big for any stock piece goes to a whole sheet; stock bins use trim 0; BOM sheet count excludes stock, cutting count includes it; `useOffcuts` off → stock ignored; produced offcuts list carries material/thickness.
- Backend: CRUD scoped to the owner; 500 cap; `/cut` deletes used and inserts produced atomically; a missing or foreign used id → 409 and nothing changes; a second `/cut` → 409; `cut_at` set.
- UI: the checkbox and count; "Kesildi" flow and its 409; the store page add / delete.
- Prod check once the server is back.
