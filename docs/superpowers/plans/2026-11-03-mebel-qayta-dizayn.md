# Mebel list and editor redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Richer project cards; an editor header with an inline title, an export menu, a confirmed "Kesildi" and a summary bar; a resizable 3D view; a parts table grouped by material with an edges drawing; and the whole editor following the app theme.

**Architecture:** One backend change (three summary fields on the list). The frontend adds small units — `ProjectCard`, `EditableTitle`, `SummaryBar`, `ResizableSplit`, `EdgeGlyph` — wires them into `MebelListPage` / `MebelProjectPage`, regroups `CutListTable`, and replaces hard-coded light classes with theme tokens across `features/mebel/ui/*`, guarded by a source-scan test.

**Tech Stack:** FastAPI (pytest), React + TanStack Query + react-three-fiber (Vitest, Testing Library), Tailwind theme tokens, zustand `useThemeStore` (`theme: "day" | "night"`).

**Spec:** `docs/superpowers/specs/2026-11-03-mebel-qayta-dizayn-design.md`

## Global Constraints

- No engine, PDF/CSV/labels content or migration change.
- Theme tokens: `bg-card`, `bg-card-soft`, `text-ink`, `text-ink-muted`, `border-line` (as the do'kon admin uses). Drawings (`SheetDrawing`, `PartDrawing`, `AssemblyDrawing`) stay on a white card; `print:` output stays light.
- 3D: night background `#1b1a2b`, grid lines `rgba(255,255,255,0.15)`; day as today (`#ffffff`, grid `#d4d4d4` / `#e5e5e5`).
- Divider: clamp 160 px … 70 % of `window.innerHeight`; default 34 vh; step 24 px; key `mebel.view3dHeight`; storage wrapped in try/catch.
- Dates via `intlLocale()`, no seconds: `dd.mm.yyyy HH:mm` style from `toLocaleString(locale, { dateStyle: "short", timeStyle: "short" })`.
- Copy uz / ru / en.

## Review Focus

1. Renaming to an empty or whitespace name → refused, the old name shows again, nothing is saved (Task 3 test).
2. `localStorage` missing or throwing (private mode, the WebView) → the divider still works at the default height (Task 4 test).
3. A project saved before free parts (no `freeParts` key) or with `data` lacking `cabinets` → the list still loads and counts 0 (Task 1 test).
4. "Kesildi" confirm cancelled → nothing is sent and the button stays (Task 3 test).
5. Nusxa olish when loading the source project fails → an error is shown and no half-made copy appears (Task 2 test).

---

### Task 1: Backend list summary fields

**Files:**
- Modify: `backend/app/schemas/mebel.py` (`ProjectSummary`), `backend/app/routers/mebel.py` (`list_projects`)
- Test: `backend/tests/test_mebel.py` (add to the list tests there)

**Interfaces:**
- Produces: `ProjectSummary { id, name, updated_at, cabinets: int = 0, free_parts: int = 0, cut_at: datetime | None = None }` — `cabinets`/`free_parts` computed from `row.data` (`len(data.get("cabinets") or [])`, `len(data.get("freeParts") or [])`); `ProjectOut` keeps its fields (it inherits these too).

- [ ] **Step 1: Write the failing tests** — `test_list_reports_counts_and_cut_at` (2 cabinets, 1 free part, cut_at set → `cabinets == 2`, `free_parts == 1`, `cut_at` echoed); `test_list_handles_old_data` (data without `freeParts` and with no `cabinets` key → 0 / 0).
- [ ] **Step 2: Run** `cd backend && ~/.cache/andoza-bvenv/bin/python -m pytest tests/test_mebel.py -q -k list` — Expected: FAIL.
- [ ] **Step 3: Implement** (a `model_validator(mode="before")` or explicit construction in the router — implementer's choice, as long as `ProjectOut` responses are unchanged apart from the new fields).
- [ ] **Step 4: Run** `pytest tests/test_mebel.py -q` — Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Mebel API: counts and cut date on the project list"`.

### Task 2: List page cards

**Files:**
- Move: `frontend/src/pages/dokon/admin/ActionMenu.tsx` → `frontend/src/components/ui/ActionMenu.tsx` (+ its test); update the do'kon imports
- Create: `frontend/src/features/mebel/ui/ProjectCard.tsx`
- Modify: `frontend/src/pages/mebel/MebelListPage.tsx`, `frontend/src/lib/api/mebel.ts` (`MebelProjectSummary` gains `cabinets`, `free_parts`, `cut_at`), `MebelListPage.test.tsx`, locales `mebel.list.*`

**Interfaces:**
- Consumes: Task 1 fields; `createMebelProject(name, data)`, `getMebelProject(id)`, `deleteMebelProject(id)`; existing confirm dialog (`useConfirm`).
- Produces: `ProjectCard({ project, onCopy, onDelete })`; `ActionMenu` at `@/components/ui/ActionMenu`.

- [ ] **Step 1: Write the failing tests** (`MebelListPage.test.tsx`)

```ts
it('a card shows "6 shkaf · 2 erkin detal", leaves out zero counts, and "Bo\'sh" when both are 0', ...)
it('a cut project carries "Kesildi <date>"', ...)
it('the date has no seconds', ...)                       // expect text not to match /\d{2}:\d{2}:\d{2}/
it('the whole card links to /mebel/:id; the ⋯ menu does not navigate', ...)
it('Nusxa olish loads the project, creates "<name> (nusxa)" with its data and opens it', ...)
it('Nusxa olish that fails to load shows an error and creates nothing', ...)   // Review Focus 5
it('O\'chirish asks first and deletes only on yes', ...)
```

- [ ] **Step 2: Run** `cd frontend && npx vitest run src/pages/mebel/MebelListPage.test.tsx` — Expected: FAIL.
- [ ] **Step 3: Implement.** uz copy: "{{n}} shkaf", "{{n}} erkin detal", "Bo'sh", "Kesildi {{date}}", "Yangilangan: {{date}}", "Nusxa olish", "O'chirish", "{{name}} (nusxa)", "Nusxa olib bo'lmadi".
- [ ] **Step 4: Run** `npx vitest run src/pages/mebel src/pages/dokon src/components/ui` — Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Mebel list: cards with counts, cut state, copy and a menu"`.

### Task 3: Editor header and summary bar

**Files:**
- Create: `frontend/src/features/mebel/ui/EditableTitle.tsx`, `frontend/src/features/mebel/ui/SummaryBar.tsx`, `frontend/src/features/mebel/ui/summary.ts`
- Modify: `frontend/src/pages/mebel/MebelProjectPage.tsx` (header, remove the left-panel name field from `ParamsPanel` usage), `frontend/src/features/mebel/ui/ParamsPanel.tsx` (drop the name field), tests, locales `mebel.header.*`, `mebel.summary.*`

**Interfaces:**
- Consumes: engine `Result` (`nesting[].sheets[].stockId`, `edgeTotals[].metersWithWaste`, `parts`, `total: number | null`, `warnings`); `ActionMenu` (Task 2).
- Produces:
  - `summarize(result: Result): { sheets: number; offcuts: number; edgeMeters: number; parts: number; total: number | null; warnings: number }` — sheets = nested sheets without `stockId`, offcuts = with `stockId`; parts = Σ `qty` of `parts` (each part is one piece → `parts.length` if parts are expanded; implementer checks `Part` and uses the piece count); edgeMeters = Σ `metersWithWaste`, 1 decimal.
  - `SummaryBar({ summary, priceReady, onOpen: (tab: TabKey) => void })` where `TabKey` is the page's existing tab id type.
  - `EditableTitle({ name, onRename: (name: string) => void })`.

- [ ] **Step 1: Write the failing tests**

```ts
// summary.test.ts
it('counts sheets and store offcuts apart, sums edge metres (1 dp), pieces, total, warnings', ...)
// MebelProjectPage.test.tsx
it('title: click → field; Enter saves the new name; Escape restores; empty/whitespace refused', ...)   // Review Focus 1
it('Eksport menu runs PDF, CSV, Excel, labels A4 and roll', ...)
it('Kesildi asks first; cancel sends nothing and keeps the button; confirm marks it', ...)            // Review Focus 4
it('⚙ opens the price book', ...)
it('summary bar shows "3 plita + 1 qoldiq · 42.5 m · 186 detal · 4 820 000 so\'m · ⚠ 3" and each part opens its tab', ...)
it('warnings segment only when there are warnings; price "—" before the price book loads', ...)
it('the left panel has no project-name field', ...)
```

- [ ] **Step 2: Run** `npx vitest run src/pages/mebel src/features/mebel/ui` — Expected: new tests FAIL.
- [ ] **Step 3: Implement.** uz copy: "Eksport", "Narxlar kitobi", "Kesildi", "Kesildi deb belgilansinmi?", "Qoldiqlar omborga yoziladi. Bu amalni ortga qaytarib bo'lmaydi.", "Ha, kesildi", "{{n}} plita", "{{n}} qoldiq", "{{m}} m kromka", "{{n}} detal", "Excel".
- [ ] **Step 4: Run** `npx vitest run src/pages/mebel src/features/mebel` — Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Mebel editor: inline title, export menu, confirmed cut, summary bar"`.

### Task 4: Resizable 3D view and warnings badge

**Files:**
- Create: `frontend/src/features/mebel/ui/ResizableSplit.tsx`, `ResizableSplit.test.tsx`
- Modify: `frontend/src/pages/mebel/MebelProjectPage.tsx` (wrap the 3D box; amber count on the Warnings tab)

**Interfaces:**
- Produces: `useStoredHeight(key: string, fallback: number): [number, (h: number) => void]` (try/catch both ways) and `ResizableSplit({ height, onHeight, min, max, label })` — renders the divider (`role="separator"`, `aria-orientation="horizontal"`, `aria-valuenow/min/max`), pointer drag + ArrowUp/ArrowDown ±24.

- [ ] **Step 1: Write the failing tests**

```ts
it('arrow keys move the divider by 24 within [min, max]', ...)
it('a drag sets the height from the pointer, clamped', ...)          // pointerdown → pointermove(clientY) → pointerup
it('the height is stored and read back', ...)
it('storage that throws still gives the default and a working divider', ...)    // Review Focus 2
it('the Warnings tab shows an amber count', ...)
```

- [ ] **Step 2: Run** `npx vitest run src/features/mebel/ui/ResizableSplit.test.tsx src/pages/mebel` — Expected: FAIL.
- [ ] **Step 3: Implement** (min 160, max `Math.round(innerHeight * 0.7)`, default `Math.round(innerHeight * 0.34)`).
- [ ] **Step 4: Run** same — Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Mebel editor: a resizable 3D view"`.

### Task 5: Parts table grouped by material, edges drawing

**Files:**
- Create: `frontend/src/features/mebel/ui/EdgeGlyph.tsx`
- Modify: `frontend/src/features/mebel/ui/CutListTable.tsx`, `CutListTable.test.tsx`, locales `mebel.edges.*`

**Interfaces:**
- Consumes: `CutGroup` (`material`, `materialId`, `thickness`, `qty`, `edges`), existing `materialName(g)`, `edgesSummary(edges)`.
- Produces: `EdgeGlyph({ edges })` — 28×18 SVG, sides L1 top / L2 bottom / W1 left / W2 right; banded side `strokeWidth 3`, visible band `currentColor`, hidden band `opacity .5`; bare side `strokeWidth .75`; `title` + `sr-only` text "L1 2 mm · L2 — · W1 0.4 mm · W2 —".

- [ ] **Step 1: Write the failing tests**

```ts
it('one header row per material + thickness with the piece count, in engine order', ...)
it('material and thickness cells are print-only; header rows are print:hidden', ...)
it('edges cell: an svg with the four sides and the sr-only/title text; print keeps edgesSummary text', ...)
```

- [ ] **Step 2: Run** `npx vitest run src/features/mebel/ui/CutListTable.test.tsx` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npx vitest run src/features/mebel src/pages/mebel` — Expected: PASS (existing PDF/print tests unchanged).
- [ ] **Step 5: Commit** `git commit -m "Mebel cut list: grouped by material, edges drawn"`.

### Task 6: Theme

**Files:**
- Modify: `frontend/src/pages/mebel/MebelProjectPage.tsx`, `frontend/src/pages/mebel/MebelOffcutsPage.tsx`, every `frontend/src/features/mebel/ui/*.tsx` that uses `bg-white` / `text-neutral-*` / `bg-neutral-*` / `border-neutral-*` / `ring-neutral-*`, `frontend/src/features/mebel/three/CabinetView.tsx`
- Create: `frontend/src/features/mebel/ui/__tests__/theme.test.ts`

**Interfaces:**
- Consumes: `useThemeStore((s) => s.theme)` (`"day" | "night"`).
- Produces: `sceneColors(theme): { background: string; grid: [string, string] }` in `CabinetView.tsx`.

- [ ] **Step 1: Write the failing tests**

```ts
// theme.test.ts — reads the source files with node fs
it('editor files use no hard-coded light classes outside drawing cards and print: variants', ...)
//   scan MebelProjectPage.tsx, MebelOffcutsPage.tsx, features/mebel/ui/*.tsx except SheetDrawing/PartDrawing/AssemblyDrawing;
//   fail on /\b(bg-white|bg-neutral-\d+|text-neutral-\d+|border-neutral-\d+|ring-neutral-\d+)\b/ unless the token is prefixed "print:"
//   or the line carries the marker comment `paper` (for the white drawing cards)
it('sceneColors: night #1b1a2b with faint grid, day white as today', ...)
```

- [ ] **Step 2: Run** `npx vitest run src/features/mebel/ui/__tests__/theme.test.ts` — Expected: FAIL listing the offending files.
- [ ] **Step 3: Implement** the token swap (`bg-white`→`bg-card`, `bg-neutral-50/100`→`bg-card-soft`, `text-neutral-900/800/700`→`text-ink`, `text-neutral-600/500/400`→`text-ink-muted`, `border/ring-neutral-*`→`border-line`/`ring-line`, `hover:bg-neutral-*`→`hover:bg-ink/10`); wrap drawings in a white card marked `{/* paper */}`; `CabinetView` reads the theme store for background and grid.
- [ ] **Step 4: Run** `npx vitest run` and `npx tsc --noEmit -p .` — Expected: all PASS.
- [ ] **Step 5: Commit** `git commit -m "Mebel editor: follows the app theme"`.
