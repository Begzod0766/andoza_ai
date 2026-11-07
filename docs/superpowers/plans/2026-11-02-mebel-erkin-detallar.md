# Mebel free parts (erkin detallar) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a workshop enter parts by hand — next to cabinets or with no cabinet — and get them in the cut list, cutting layout, band metres, price, CSV, PDF and labels.

**Architecture:** A `freeParts` list on the project; the engine turns each row into `qty` ordinary `Part`s (`role: 'free'`) appended after the cabinet parts, so every existing consumer picks them up. The backend validates the list in the stored JSON (no migration). A folding "Erkin detallar" section in the left panel edits it.

**Tech Stack:** TypeScript/React (Vite, Vitest, Testing Library), FastAPI + Pydantic (pytest).

**Spec:** `docs/superpowers/specs/2026-11-02-mebel-erkin-detallar-design.md`

## Global Constraints

- Free-part size: whole mm, **10–3000** for length and width; qty whole **1–100**; name **1–60** chars; at most **100** rows.
- A project keeps at least one cabinet **or** one free part; cabinets may be 0 when a free part exists.
- Part ids `D<n>-<k>` (row label `D<n>`, piece `k` from 1); `cabinetId` = the row's `id`.
- Material: `'board'` → board materialId/thickness; `'back'` → back materialId/thickness; `'facade'` → facade materialId/thickness (LDSP door sheet).
- Bands: `'visible' | 'hidden' | null` per side → `EdgeSide` from `defaults.edge.visible/hidden` thickness (0 thickness → null), exactly as cabinet parts do.
- No holes, zero-size placement (not drawn in 3D), no hardware.
- UI copy in uz / ru / en; existing untranslated-text test must stay green.

## Review Focus

1. A free part whose cut size exceeds the sheet → reported in `nesting[].unplaced` and the PDF's unplaced list, project still computes (test in Task 1).
2. An old project saved without `freeParts` → opens and computes unchanged (Task 1 engine test; Task 2 backend test).
3. Removing the last cabinet while free parts exist → allowed; with no free part → button absent (Task 3).
4. A free part with `material: 'facade'` while the facade kind is `'mdf'` or `'none'` → still cut from the facade LDSP thickness/materialId setting, never sent to the MDF order (Task 1 test).
5. Two free rows with the same size but different names → the cut list shows both names, not "Erkin detal" (Task 1 test on `groupName`).

---

### Task 1: Engine — free parts become parts

**Files:**
- Modify: `frontend/src/features/mebel/engine/model.ts` (types)
- Create: `frontend/src/features/mebel/engine/rules/freeParts.ts`
- Modify: `frontend/src/features/mebel/engine/index.ts` (append parts; `normalizeProject` gives `freeParts: []`)
- Modify: `frontend/src/features/mebel/engine/validate.ts` (free-part errors; empty project; cabinets may be 0)
- Modify: `frontend/src/features/mebel/engine/cutlist.ts` (group key and `names`)
- Modify: `frontend/src/features/mebel/ui/format.ts` (`partName(role, name?)`, `groupName` uses `names`)
- Test: `frontend/src/features/mebel/engine/__tests__/freeParts.test.ts`

**Interfaces:**
- Produces:
  - `type Band = 'visible' | 'hidden' | null`
  - `interface FreePartSpec { id; label; name; length; width; qty; material: 'board'|'back'|'facade'; grain: 'length'|'none'; edges: { L1: Band; L2: Band; W1: Band; W2: Band } }`
  - `FurnitureProject.freeParts?: FreePartSpec[]`; `PartRole` adds `'free'`; `Part.name?: string` (free parts only); `CutGroup.names: string[]` (distinct `name`s of free parts on the line).
  - `newFreePart(label: string): FreePartSpec` in `model.ts` — new uuid, name = the label (`"D1"`), 600×400, qty 1, `'board'`, `'length'`, all bands null.
  - `freePartParts(spec: FreePartSpec, d: ConstructionDefaults): Part[]` in `rules/freeParts.ts`.
  - Validation codes: `free_size`, `free_qty`, `free_name`, `too_many_free`, `empty_project`; free-part errors carry `cabinetId = spec.id`.
  - `partName(role: PartRole, name?: string): string` — returns `name` when role is `'free'` and name is set.

- [ ] **Step 1: Write the failing tests** (`freeParts.test.ts`)

```ts
const free = (o: Partial<FreePartSpec> = {}): FreePartSpec => ({ ...newFreePart('D1'), id: 'f1', name: 'Stoleshnitsa', length: 2400, width: 600, ...o })
it('qty 3 gives three parts D1-1..D1-3 with the entered finished size', ...)   // ids, finished {2400,600}, role 'free', name 'Stoleshnitsa', cabinetId 'f1', no holes
it('cut size takes the bands off unless premilled', ...)                       // edges L1 visible(2) + W1 hidden(0.4): cut {2399.6, 598}; premilled → {2400,600}
it('material picks thickness and materialId from the matching setting', ...)   // board 18 / back 4 / facade 18 (also when facade.kind is 'mdf': still a part, facadeOrder unchanged)
it('free parts reach groups, nesting, edge totals and the BOM', ...)           // computeProject with one cabinet + free part: a group with role 'free'; board sheets ≥ cabinet-only; edge metres grow
it('a project with only free parts computes', ...)                             // cabinets: [], freeParts: [free()] → errors [], parts.length 1
it('a free part bigger than the sheet is unplaced, the rest computes', ...)    // length 3000, width 2100, grain 'length' on 2800×2070 → nesting unplaced contains 'D1-1'
it('validation', ...)  // length 5 → free_size; 3001 → free_size; 600.5 → free_size; qty 0 / 101 / 1.5 → free_qty; name '' → free_name; 101 rows → too_many_free; no cabinet + no free part → empty_project; each free error has cabinetId 'f1'
it('an old project without freeParts computes as before', ...)                // delete p.freeParts → same parts as before
it('the cut list names free parts by their own names', ...)                    // two rows same size, names 'A' and 'B' → one group, groupName(g) === 'A, B'
```

- [ ] **Step 2: Run** `cd frontend && npx vitest run src/features/mebel/engine/__tests__/freeParts.test.ts` — Expected: FAIL (module `../rules/freeParts` not found).

- [ ] **Step 3: Implement** the types, `newFreePart`, `freePartParts` (existing `cutSize(finished, edges, d.edge.premilled)`; placement all zeros). In `computeProject` append `p.freeParts.flatMap(f => freePartParts(f, p.defaults))` to `parts` after `drillParts` (free parts have no holes). `normalizeProject` sets `freeParts: p.freeParts ?? []`. Validation as listed (`too_many_cabinets` stays; `cabinets.length === 0 && freeParts.length === 0` → `empty_project`). `groupParts` keeps its key (parts of equal size still share a line) and collects distinct free-part `name`s into `names`; `groupName` maps roles with `partName`, putting `names.join(', ')` in place of `'free'`.

- [ ] **Step 4: Run** the test file and `npx vitest run src/features/mebel` — Expected: all PASS (existing tests unchanged).

- [ ] **Step 5: Commit** `git commit -m "Mebel engine: free parts become parts"` (engine files + test).

### Task 2: Backend — validate `freeParts`

**Files:**
- Modify: `backend/app/schemas/mebel.py` (`FreePartIn`, `ProjectData.freeParts`, empty-project check)
- Test: `backend/tests/test_mebel.py`

**Interfaces:**
- Consumes: the JSON shape of `FreePartSpec` (Task 1).
- Produces: `MAX_FREE_PARTS = 100`; `FreePartIn` (extra allowed): `id` 1–64, `name` 1–60, `length`/`width` int 10–3000, `qty` int 1–100, `material` in {board, back, facade}, `grain` in {length, none}; `ProjectData.freeParts: list[FreePartIn] = []` (max 100); model validator: `cabinets` and `freeParts` both empty → error.

- [ ] **Step 1: Write the failing tests**

```python
def test_free_parts_are_saved_with_the_project(client): ...          # PUT data with 1 cabinet + 1 free part → 200, GET returns freeParts
def test_a_project_of_only_free_parts_is_accepted(client): ...      # cabinets [] + 1 free part → 200
def test_an_empty_project_is_refused(client): ...                    # cabinets [] + freeParts [] → 422
def test_free_part_limits(client): ...                               # length 9 / 3001, qty 0 / 101, name "" , 101 rows → 422 each
def test_an_old_payload_without_free_parts_still_saves(client): ...  # no freeParts key → 200
```

- [ ] **Step 2: Run** `cd backend && pytest tests/test_mebel.py -q` — Expected: new tests FAIL.
- [ ] **Step 3: Implement** the schema changes.
- [ ] **Step 4: Run** `pytest tests/test_mebel.py tests/test_mebel_ai.py -q` — Expected: all PASS.
- [ ] **Step 5: Commit** `git commit -m "Mebel API: validate free parts"`.

### Task 3: UI — "Erkin detallar" section, names in labels

**Files:**
- Create: `frontend/src/features/mebel/ui/FreePartsPanel.tsx`
- Modify: `frontend/src/features/mebel/ui/ParamsPanel.tsx` (render the panel after the cabinets; remove button shown when `cabinets.length > 1 || freeParts.length > 0`)
- Modify: `frontend/src/features/mebel/export/labels.ts` (`PartLabel.name?: string` from `Part.name`) and `LabelsPrintView.tsx` / `DrillingPanel.tsx` / `PrintView.tsx` call sites of `partName` pass `p.name`
- Modify: `frontend/src/i18n/locales/{uz,ru,en}.json` (`mebel.free.*`, `mebel.part.free`, `mebel.error.free_*`, `mebel.error.too_many_free`, `mebel.error.empty_project`)
- Test: `frontend/src/pages/mebel/MebelProjectPage.test.tsx`, `frontend/src/features/mebel/export/__tests__/labels.test.tsx`

**Interfaces:**
- Consumes: `FreePartSpec`, `newFreePart`, validation codes (Task 1).
- Produces: `FreePartsPanel({ project, update, errors })` — `<details data-testid="section-free" open>` with a "+ Detal" button; rows `<details data-testid="free-D1">` with summary `D1 · <name> · <L>×<W> · <qty> dona` (red dot `data-testid="free-error-dot"` on error, open while it has one); fields with ids `${id}-name|len|wid|qty|mat|grain`; four band buttons labelled `L1 L2 W1 W2` whose `aria-pressed`/text cycle `—` → visible thickness → hidden thickness; "Nusxa"; "Olib tashlash" through `useConfirm` (`mebel.free.remove_confirm`, `{label}`). New rows numbered `D<max+1>`; one row open at a time; a new row opens.

- [ ] **Step 1: Write the failing tests** (page test)

```ts
it('+ Detal adds D1, editable, and it shows in the cut list', ...)       // click "+ Detal"; set name "Sokol", length 2400, width 100, qty 2 → cut-list row containing "Sokol", Soni 2
it('band buttons cycle none → visible → hidden', ...)                     // L1 text "—" → "2" → "0.4"
it('a free-part error marks its field and row', ...)                       // length 5 → field error text (mebel.error.free_size), free-error-dot present
it('the last cabinet can go once a free part exists', ...)                 // 1 cabinet: no remove button; add a free part → remove button present → confirm → cabinets 0, still computes
it('removing a free part asks first', ...)                                 // dialog text t('mebel.free.remove_confirm', {label:'D1'}); cancel keeps it
```
and in `labels.test.tsx`: `it('a free part label carries its own name', ...)` — `partLabels` of a free part → `name === 'Stoleshnitsa'`; view shows "Stoleshnitsa".

- [ ] **Step 2: Run** `cd frontend && npx vitest run src/pages/mebel src/features/mebel/export` — Expected: new tests FAIL.
- [ ] **Step 3: Implement** the panel, the wiring and the strings (uz: section "Erkin detallar", add "+ Detal", remove_confirm "{{label}} detalini olib tashlaysizmi?", qty unit "dona", material options "LDSP" / "HDF" / "Fasad LDSP", grain "Uzunlik bo'ylab" / "Yo'q", part.free "Erkin detal", error.free_size "O'lcham 10–3000 mm, butun son", error.free_qty "Soni 1–100", error.free_name "Nom kiriting", error.too_many_free "Ko'pi bilan 100 ta erkin detal", error.empty_project "Kamida bitta shkaf yoki detal kerak"; ru/en equivalents).
- [ ] **Step 4: Run** `npx vitest run` (whole suite) and `npx tsc --noEmit -p .` — Expected: all PASS, no type errors.
- [ ] **Step 5: Commit** `git commit -m "Mebel: free parts section in the page"`.
