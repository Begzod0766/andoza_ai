# Mebel: erkin detallar (free parts) — design

**Date:** 2026-11-02 · **Status:** approved in chat (approach A) · **Area:** `/mebel/:id`

## Why

Every part on `/mebel` today comes from a cabinet. Workshops also cut parts that belong to no cabinet — a worktop, a plinth strip, a loose shelf, a side panel — and many jobs are a plain list of parts brought by a customer ("sof raskroy"). Every cutting program in the comparison (OptiCut, Bazis-Raskroy, Astra, Raspili) takes such a list. Without it the tool is only for kitchen cabinets.

Success: a workshop can enter a list of parts by hand, alone or next to cabinets, and get the same cutting layout, band metres, sheet count, price, CSV, PDF and labels it gets for cabinet parts.

## Decisions (from the brainstorm)

- Both uses: free parts next to cabinets **and** projects with no cabinet at all.
- Full fields per part (below); no hand-placed holes.
- Approach A: a separate `freeParts` list on the project, turned into ordinary engine `Part`s. Rejected: a fake "panel" cabinet type (special cases in 3D, drilling, layout, validation); a separate project kind (cannot mix with cabinets).

## Data model

`FurnitureProject.freeParts?: FreePartSpec[]` (optional; old projects have none).

```ts
interface FreePartSpec {
  id: string            // uuid
  label: string         // "D1", "D2" … numbered like cabinets
  name: string          // free text, 1–60 chars, e.g. "Stoleshnitsa"
  length: number        // finished size, whole mm, 10–3000
  width: number         // finished size, whole mm, 10–3000
  qty: number           // whole, 1–100
  material: 'board' | 'back' | 'facade'   // LDSP at the project's board thickness | HDF | door LDSP
  grain: 'length' | 'none'
  edges: { L1: Band; L2: Band; W1: Band; W2: Band }   // Band = 'visible' | 'hidden' | null
}
```

Limits: at most **100** free-part rows per project. Cabinets may now be **0** if at least one free part exists; a project must keep at least one cabinet or one free part.

## Engine

- `freePartParts(spec, defaults) → Part[]`: one `Part` per piece (`qty` 1 each), ids `D1-1`, `D1-2` …, `cabinetId` = the free part's id, `role: 'free'`, `materialId` from the matching default (board / back / facade), thickness from the board, back or facade setting, `finished` = the entered size, `cut` via the existing `cutSize` (bands taken off unless premilled), `grain` as entered (`'none'` lets nesting turn it), no `holes`, `placement` zero-size (not drawn in 3D).
- `computeProject` appends free-part parts after cabinet parts, so groups, edge totals, nesting, BOM, warnings, CSV, PDF and labels include them with no other change. Hardware counts are unaffected.
- Validation (`validateProject`): `free_size` (length/width outside 10–3000 or not whole), `free_qty` (not 1–100 whole), `free_name` (empty), `too_many_free` (>100), `empty_project` (no cabinet and no free part). Errors carry the free part's id so the field is marked, like cabinet errors.
- `PartRole` gains `'free'`; its display name is the part's own `name` (cut list, labels, PDF).

## Backend

`ProjectData.freeParts: list[FreePartIn]` (default `[]`, max 100) with the same limits; `cabinets` may be empty only when `freeParts` is not; an empty project is a 422. Stored in the existing JSON column — no migration.

## UI (left panel)

A folding section **"Erkin detallar"** after "Shkaflar":
- header with **"+ Detal"**;
- one-line rows `D1 · Stoleshnitsa · 2400×600 · 1 dona`, one open at a time, a red dot when the row has an error (same behaviour as cabinet rows);
- open row: name, length, width, qty, material select, grain select, four band toggles L1 / L2 / W1 / W2 (each cycles none → visible → hidden), "Nusxa", "Olib tashlash" (asks first).

A cabinet can now be removed while at least one free part exists. The cut list names a free part by its `name`; the drilling tab lists none. uz / ru / en strings.

## Out of scope

Holes on free parts, non-rectangular parts, importing a parts list from a file, offcut stock — later work.

## Testing

- Engine: qty expands to N parts with ids `D1-1…`; cut size subtracts bands; parts reach groups, nesting, BOM and edge totals; a project with only free parts computes; a free part bigger than the sheet is reported unplaced; each validation code.
- Backend: limits, empty project 422, cabinets-empty-with-free-parts accepted, old payload without `freeParts` accepted.
- UI: add, edit, band toggles, duplicate, remove-with-confirm; removing the last cabinet allowed only with a free part present; free parts appear in the cut list and labels.
- Prod check after deploy.
