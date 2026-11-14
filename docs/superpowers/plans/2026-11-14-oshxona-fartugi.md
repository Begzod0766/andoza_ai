# Oshxona fartugi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kitchen backsplashes (tile or skinali) set in the wall panel, drawn in 3D, priced in the estimate.

**Architecture:** `designState.backsplashes` list; one shared rule for "the backsplash less the openings" in `frontend/src/lib/backsplash.ts` and its mirror `backend/app/services/backsplash.py`, pinned by a shared JSON fixture; estimate lines in `smeta.py`; a `Backsplashes3D` component; a block in `WallSection`.

**Tech Stack:** React/zustand/r3f + vitest; FastAPI services + pytest; i18next.

**Spec:** docs/superpowers/specs/2026-11-14-oshxona-fartugi-design.md

## Global Constraints
- Old rooms (no `backsplashes`) read and price exactly as today.
- Backsplash numbers in mm; wall frame = `roomModel(geometry).walls` (door `position` frame).
- Defaults: start 0, length min(wall, 3000), 850–1450, tile `#F2EFE9`, skinali `#FFFFFF`.
- Norms: `work_backsplash_m2_uzs` 130000, `skinali_m2_uzs` 450000, `work_skinali_m2_uzs` 80000; tile waste 1.10; skinali no waste.
- Labels exactly: "Fartuk plitkasi", "Ish: fartuk plitkasini terish", "Skinali (shisha fartuk)", "Ish: skinali o'rnatish"; category `fartuk` → group `pardoz`.

## Review Focus
- A window whose sill sits inside the band (kitchen window over the worktop): the piece under the sill and the pieces either side are kept; area subtracts only the overlap.
- A backsplash longer than its wall, or on a wall later removed: clamped / dropped, never negative area.
- A wall tiled to the ceiling with a tile backsplash on it: the overlap is not tiled twice.
- Geometry in metres on the backend (`_to_metres`) gives the same area as mm.
- A room that is not a kitchen still prices backsplashes it has; the panel block shows only in a kitchen.

---

### Task 1: Shared rule — `lib/backsplash.ts`
**Files:** Create `frontend/src/lib/backsplash.ts`, `frontend/src/lib/__tests__/backsplash.test.ts`, `frontend/src/lib/__tests__/fixtures/backsplashPieces.json`; Modify `frontend/src/store/types.ts`.

**Produces:**
- `type Backsplash = { id; wallId; material: 'tile'|'skinali'; startMm; lengthMm; bottomMm; topMm; color }`, `DesignState.backsplashes?: Backsplash[]`.
- `newBacksplash(geometry, wallId): Backsplash` (defaults above, nanoid id).
- `saneBacksplashes(saved: unknown): Backsplash[]` (shape check only).
- `clampBacksplash(b, wallLengthMm, ceilingMm): Backsplash | null` (spec clamp rules; null when too thin or the wall is gone — caller passes length).
- `backsplashPieces(b, geometry, ceilingMm): Rect[]` where `Rect = { x0; x1; y0; y1 }` mm in the wall's own frame (x along, y up), the clamped rectangle less each resolved opening, pieces < 10 mm dropped.
- `backsplashAreaM2(pieces): number`.

Steps: tests (fixture cases: plain; door at the start; window with sill 900 inside 850–1450; longer than wall; wall gone → []; too thin → []); see RED; implement (rectangle subtraction: for each opening split every rect into up to 4); GREEN.

### Task 2: Backend mirror and estimate
**Files:** Create `backend/app/services/backsplash.py`, `backend/tests/test_backsplash.py`, `backend/tests/test_smeta_backsplash.py`; Modify `smeta.py`, `tile_norms.json`, `smeta_keys.py`, `smeta_groups.py` (+ frontend `lib/smetaGroups.ts`), `smeta_text.py`, `test_estimate_catalog.py` if the key list is pinned there, `adminMaterials.ts`.

**Produces:** `valid_backsplashes(saved, geometry, ceiling_mm) -> list[dict]`, `backsplash_pieces(b, geometry, ceiling_mm) -> list[tuple]`, `_backsplash_lines(room, catalog) -> (lines, tile_m2)`.

Steps: `test_backsplash.py` runs the shared fixture (geometry in mm and converted to metres); `test_smeta_backsplash.py`: none → no lines; one tile 1.2×0.6 → "Fartuk plitkasi" 0.79 m² (0.72 × 1.10) and work 0.72 m² × 130 000, adhesive/grout area grows by 0.72; skinali → 0.72 m² × 450 000 and work × 80 000; shop `skinali` per m² priced; wall tiled to ceiling loses the overlap; category `fartuk` grouped `pardoz`; labels ru/en exact. RED → implement → GREEN; full backend suite.

### Task 3: Panel block
**Files:** Create `frontend/src/components/studio/design-panel/BacksplashControls.tsx` (+test); Modify `WallSection.tsx`, i18n uz/ru/en, `smetaLineText.ts` (+test).

Steps: tests (block hidden outside a kitchen; "Fartuk qo'shish" adds one on the picked wall with defaults; material switch; height chip; length field in cm; remove; one undo step per change). RED → implement → GREEN.

### Task 4: 3D
**Files:** Create `frontend/src/pages/studio/three-d/Backsplashes3D.tsx` (+`__tests__/backsplashes3D.test.ts` for the pure pose helper); Modify the scene that mounts `TowelRails3D`.

**Produces:** `backsplashPieceBoxes(b, geometry, ceilingMm): Array<{ x; y; z; rotY; w; h }>` world metres (piece centre 3 mm + 3 mm off the wall).

Steps: test the helper (centre, rotation along the wall normal, hidden wall none); RED → implement → GREEN; full vitest + `tsc -b`; regenerate `smeta_locale.json`; QA doc; PR.
