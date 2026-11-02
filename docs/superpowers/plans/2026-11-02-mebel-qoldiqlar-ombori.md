# Mebel offcut stock (qoldiqlar ombori) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A per-user store of offcuts that a job's cutting layout uses before whole sheets, filled from a job's layout on "Kesildi" or by hand.

**Architecture:** A `mebel_offcuts` table with CRUD and an atomic `POST /projects/{id}/cut`. The frontend engine's `nestSheets` takes optional stock pieces and fills matching ones (trim 0) before whole sheets; the BOM counts only whole sheets. The project page fetches the store, passes it when `defaults.useOffcuts`, and runs "Kesildi"; a new `/mebel/qoldiqlar` page lists and edits the store.

**Tech Stack:** TypeScript/React (Vitest, Testing Library, TanStack Query), FastAPI + SQLAlchemy + Alembic (pytest).

**Spec:** `docs/superpowers/specs/2026-11-02-mebel-qoldiqlar-ombori-design.md`

## Global Constraints

- Offcut size: whole mm **200–5000** each side; thickness whole 1–50; material `board | back | facade`; at most **500** per user.
- Saved offcuts are the layout's `offcuts` (already ≥ 200 × 200 mm, `MIN_OFFCUT`).
- Stock bins: **trim 0**, the project's kerf; match on material **and** materialId (null = null) **and** thickness.
- BOM sheet lines count whole sheets only; the cutting-service line counts whole sheets + stock bins.
- "Kesildi" is one transaction; a missing/foreign used id or an already-cut project → **409**, nothing changes. 409 detail (uz): "Qoldiqlar o'zgargan — raskroyni yangilang" / "Loyiha allaqachon kesilgan".
- Every offcut query filters by the caller's `user_id`. Migration revision `1786000047`, down `1786000046`.
- UI copy uz / ru / en; untranslated-text test stays green.

## Review Focus

1. Two jobs planned on the same offcut; the second "Kesildi" → 409 with the message and a refreshed store, not a silent double use (Task 2 test, Task 3 UI test).
2. Old projects without `useOffcuts` and a user with an empty store → layout and BOM exactly as before (Task 1 test).
3. A stock piece smaller than every part → not used, not listed as a bin, not consumed by "Kesildi" (Task 1 test).
4. Deleting a project that produced offcuts → its offcuts stay, `source_project_id` becomes null (Task 2 test).
5. A project whose layout fails (validation errors) → "Kesildi" disabled (Task 3 test).

---

### Task 1: Engine — stock-aware nesting and BOM

**Files:**
- Modify: `frontend/src/features/mebel/engine/model.ts` (`StockPiece`, `NestedSheet.stockId/size`, `ConstructionDefaults.useOffcuts?`)
- Modify: `frontend/src/features/mebel/engine/nest.ts`, `bom.ts`, `index.ts`
- Create: `frontend/src/features/mebel/engine/offcuts.ts` (`producedOffcuts`)
- Test: `frontend/src/features/mebel/engine/__tests__/stock.test.ts`

**Interfaces:**
- Produces:
  - `interface StockPiece { id: string; material: 'board'|'back'|'facade'; materialId: string | null; thickness: number; length: number; width: number }`
  - `NestedSheet.stockId?: string`, `NestedSheet.size: { length: number; width: number }` (set for every sheet).
  - `nestSheets(groups, sheet, opts, stock: StockPiece[] = []): NestResult[]` — per board, matching stock first (bins listed first in `sheets`), unused stock dropped.
  - `computeProject(project, prices, catalog, stock: StockPiece[] = []): Result` — stock used only if `defaults.useOffcuts`.
  - `producedOffcuts(nesting: NestResult[]): Omit<StockPiece, 'id'>[]` and `usedStockIds(nesting: NestResult[]): string[]` in `offcuts.ts`.
- Approach: give `packOnce` an initial list of bins — stock pieces sorted by area, largest first, each `{ free: [{x:0,y:0,length,width}], size, stockId }` — tried before opening a whole sheet; when choosing the best of the 16 runs compare (unplaced, whole sheets, last whole sheet's area). Drop stock bins with no placement. Utilization per bin uses `size`.

- [ ] **Step 1: Write the failing tests** (`stock.test.ts`)

```ts
it('a part that fits a stock piece goes there and whole sheets drop', ...)      // 4×600 cabinets (2 sheets) + stock 2000×1200 board/null/18 → whole board sheets 1, first sheet has stockId
it('stock of another material, materialId or thickness is ignored', ...)          // stock back/4, board 'x'/18, board null/16 → no stockId anywhere
it('a stock piece too small for every part is not used', ...)                     // stock 210×210 → not in sheets, usedStockIds []
it('stock bins have no trim: a part of exactly the bin size fits', ...)            // group of one 800×600 part, stock 800×600 → placed at x 0 y 0 on the bin
it('BOM: sheets count whole sheets only, cutting counts stock bins too', ...)       // with the 2000×1200 stock: board_18 qty 1, cut qty = whole + bins
it('useOffcuts off, or an empty store: layout as before', ...)                      // computeProject(p, …, stock) with useOffcuts false deep-equals computeProject(p, …)
it('produced offcuts carry the bin material, materialId and thickness', ...)        // producedOffcuts(nesting) all ≥200×200, material/thickness match their board
```

- [ ] **Step 2: Run** `cd frontend && npx vitest run src/features/mebel/engine/__tests__/stock.test.ts` — Expected: FAIL (no `../offcuts`).
- [ ] **Step 3: Implement** as in Interfaces; `buildBom` sheet line `qty = sheets.filter(s => !s.stockId).length`, cutting line counts all sheets.
- [ ] **Step 4: Run** `npx vitest run src/features/mebel src/pages/mebel` — Expected: all PASS (existing nest invariants test still green).
- [ ] **Step 5: Commit** `git commit -m "Mebel engine: cutting layout uses offcut stock first"`.

### Task 2: Backend — offcuts table, API and "cut"

**Files:**
- Create: `backend/alembic/versions/1786000047_mebel_offcuts.py`, `backend/app/models/mebel_offcut.py`
- Modify: `backend/app/models/furniture_project.py` (`cut_at`), `backend/app/models/__init__.py` (register), `backend/app/schemas/mebel.py` (`OffcutIn`, `OffcutOut`, `CutIn`, `ProjectOut.cut_at`), `backend/app/routers/mebel.py`, `backend/app/i18n/messages.py` (two 409 messages)
- Test: `backend/tests/test_mebel_offcuts.py`

**Interfaces:**
- Produces: `GET/POST /api/v1/mebel/offcuts`, `DELETE /api/v1/mebel/offcuts/{id}`, `POST /api/v1/mebel/projects/{id}/cut` with body `{used: uuid[], produced: OffcutIn[]}`; `OffcutIn {material, materialId: str|None, thickness: int 1–50, length/width: int 200–5000}`; `OffcutOut` adds `id`, `source_project_id`, `created_at` (camelCase alias `materialId` as in the frontend); `ProjectOut.cut_at: datetime | None`. `MAX_OFFCUTS = 500`.

- [ ] **Step 1: Write the failing tests** (follow `tests/test_mebel.py`'s `_user/_db/_as` mocking style)

```python
def test_list_and_add_offcuts_are_the_callers(client): ...
def test_offcut_limits(client): ...                    # 199 / 5001 / thickness 0 / material "glass" → 422; 500 existing → 422
def test_delete_foreign_offcut_is_404(client): ...
def test_cut_moves_used_out_and_produced_in(client): ...   # deletes used rows, adds produced with source_project_id, sets cut_at
def test_cut_with_a_missing_offcut_is_409_and_changes_nothing(client): ...
def test_cut_twice_is_409(client): ...
def test_offcuts_survive_their_project(): ...           # model FK ondelete SET NULL (inspect the column)
```

- [ ] **Step 2: Run** `cd backend && pytest tests/test_mebel_offcuts.py -q` — Expected: FAIL (404 routes).
- [ ] **Step 3: Implement** the migration (table + index on `user_id` + `furniture_projects.cut_at`), model, schemas, routes (`/cut`: select used with `FOR UPDATE` filtered by user; count mismatch → 409; delete; insert; set `cut_at`; one commit).
- [ ] **Step 4: Run** `pytest tests/test_mebel.py tests/test_mebel_offcuts.py tests/test_mebel_ai.py -q` — Expected: all PASS.
- [ ] **Step 5: Commit** `git commit -m "Mebel API: offcut stock and cut"`.

### Task 3: Project page — use the store, "Kesildi"

**Files:**
- Modify: `frontend/src/lib/api/mebel.ts` (`listOffcuts`, `addOffcut`, `deleteOffcut`, `cutMebelProject`, types)
- Modify: `frontend/src/features/mebel/useMebelProject.ts` (fetch `["mebel","offcuts"]`, pass stock to `computeProject`)
- Modify: `frontend/src/features/mebel/ui/ParamsPanel.tsx` (checkbox in "Konstruksiya" with count), `NestingPanel.tsx` and `export/PrintView.tsx` (bin caption "Qoldiq · L×W"), `frontend/src/pages/mebel/MebelProjectPage.tsx` ("Kesildi" button / "Kesilgan: date")
- Modify: `frontend/src/i18n/locales/{uz,ru,en}.json` (`mebel.offcuts.*`)
- Test: `frontend/src/pages/mebel/MebelProjectPage.test.tsx`

**Interfaces:**
- Consumes: Task 1 `computeProject(..., stock)`, `producedOffcuts`, `usedStockIds`; Task 2 routes.
- Produces: `cutMebelProject(id: string, body: { used: string[]; produced: OffcutIn[] }): Promise<MebelProject>`; `MebelProject.cut_at?: string | null`.

- [ ] **Step 1: Write the failing tests**

```ts
it('the checkbox uses the store: a sheet becomes "Qoldiq · 2000×1200"', ...)   // mock listOffcuts → [2000×1200 board null 18]; tick → nesting caption contains t('mebel.offcuts.bin', {l:2000,w:1200})
it('Kesildi sends the used and produced offcuts, then shows the date', ...)     // confirm → cutMebelProject called with used ['o1'] and produced (all ≥200); header shows t('mebel.offcuts.cut_at', …)
it('a 409 on Kesildi shows its message and refetches the store', ...)
it('Kesildi is disabled while the layout has errors', ...)
```

- [ ] **Step 2: Run** `npx vitest run src/pages/mebel/MebelProjectPage.test.tsx` — Expected: new tests FAIL.
- [ ] **Step 3: Implement** (uz strings: checkbox "Qoldiqlardan foydalanish (omborda {{n}} ta)", bin "Qoldiq · {{l}}×{{w}}", button "Kesildi", confirm "{{used}} ta qoldiq ombordan chiqadi, {{made}} ta yangi qoldiq qo'shiladi", done "Kesilgan: {{date}}"; ru/en equivalents).
- [ ] **Step 4: Run** `npx vitest run src/pages/mebel src/features/mebel` — Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Mebel: project page uses the offcut store, Kesildi"`.

### Task 4: Store page `/mebel/qoldiqlar`

**Files:**
- Create: `frontend/src/pages/mebel/MebelOffcutsPage.tsx`, `frontend/src/pages/mebel/MebelOffcutsPage.test.tsx`
- Modify: `frontend/src/router.tsx` (route inside the app shell next to `/mebel`), `frontend/src/pages/mebel/MebelListPage.tsx` (header link "Qoldiqlar ombori"), locales

**Interfaces:**
- Consumes: Task 3 API functions.
- Produces: page with groups by `material + thickness` (heading e.g. "LDSP 18 mm"), rows `L × W · <catalogue name or "Tanlanmagan"> · <source project name or "qo'lda">`, delete with `useConfirm`, an add form (material, catalogue material, thickness, length, width) that calls `addOffcut` and refetches; empty state "Omborda qoldiq yo'q".

- [ ] **Step 1: Write the failing tests**

```ts
it('lists offcuts grouped by material and thickness', ...)
it('adds an offcut by hand', ...)          // fill form → addOffcut called with the values
it('deleting asks first', ...)
it('the list page links to the store', ...)  // MebelListPage has link to /mebel/qoldiqlar
```

- [ ] **Step 2: Run** `npx vitest run src/pages/mebel` — Expected: new tests FAIL.
- [ ] **Step 3: Implement** the page, route, link and strings (theme tokens like `MebelListPage`).
- [ ] **Step 4: Run** `npx vitest run` and `npx tsc --noEmit -p .` — Expected: all PASS.
- [ ] **Step 5: Commit** `git commit -m "Mebel: offcut store page"`.
