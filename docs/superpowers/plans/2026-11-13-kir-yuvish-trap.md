# Washing Machine and Floor Drain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A washing machine the user adds and slides along a wall, whose two points join the pipe scheme and whose connection is priced; and a floor drain priced in place of a shower tray trap when the user says the shower has no tray.

**Architecture:** The machine copies the towel rail: a record list `washers` in the room state, drawn in code, its points worked out (never saved) by one rule on both sides, pinned by a shared fixture file. The estimate adds per-machine part and work lines through the existing `_piece_line`; the floor drain is a `designState` switch read in `_plumbing_lines`.

**Tech Stack:** FastAPI backend (pytest), React + zustand/zundo + react-three-fiber frontend (vitest), i18next uz/ru/en.

**Spec:** `docs/superpowers/specs/2026-11-13-kir-yuvish-trap-design.md`

## Global Constraints

- Machine box 600 × 600 × 850 mm, back 20 mm off the wall; points: cold Ø20 at centre + 150 mm, 900 mm high; drain Ø50 at centre − 150 mm, 600 mm high.
- The machine itself is never priced.
- Norms (UZS), in `backend/app/data/plumbing_norms.json`: `kran_kir` 60 000, `sifon_kir` 70 000, work `work_washer_uzs` 150 000; `trap_pol` 450 000, work `work_floor_drain_uzs` 200 000.
- Shop keys `kran_kir`, `sifon_kir`, `trap_pol`: sold by the piece (`KEY_PACK_UNIT` None, sale unit `dona`), written literally in the `KEY_PACK_UNIT` dict (the admin sync test reads that block), added to `estimate_catalog._PIECE_KEYS`, `adminMaterials.ts` `SMETA_KEYS`, and `test_estimate_catalog`'s `admin_added`.
- Labels (uz, as the estimate writes them): `Kir yuvish mashinasi krani`, `Kir yuvish mashinasi sifoni`, `Ish: kir yuvish mashinasini ulash`, `Pol trapi`, `Ish: trap o'rnatish`. Each in ru/en under `smeta.line.*`, mirrored in `smetaLineText.ts` and `smeta_text.py` (product-prefix map for the three shop-keyed ones, whole-label map for all five), `smeta_locale.json` refreshed with `python -m app.services.smeta_text ../frontend/src/i18n/locales`.
- `designState.floorDrain` counts only when exactly `true`.
- Commit trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. After `tsc -b`, delete `frontend/vite.config.js`, `vite.config.d.ts`, `tsconfig*.tsbuildinfo`.

## Review Focus

1. A machine on a wall that has a door: it must not stand in the doorway, after placing, dragging, or a door added later (Task 1 `keepWashers` + Task 2 geometry test).
2. Two machines added one after the other must not overlap each other or a towel rail (Task 1 `placeWasher` test with `others`).
3. A room saved before this change (no `washers` key) must load and price exactly as before (Task 2 load test, Task 4 no-machine test).
4. The machine's points must not be saved into `plumbing` or double-counted if one slips in (Task 4: a stray `washerId` point in `plumbing` is ignored).
5. Floor drain on in a room with no shower adds nothing; off is the default (Task 5).

---

### Task 1: The machine's rule (frontend lib, backend service, shared fixture)

**Files:**
- Create: `frontend/src/lib/washer.ts`, `backend/app/services/washer.py`
- Create: `frontend/src/lib/__tests__/fixtures/washerPoints.json` (cases: geometry in mm, `washers`, `expected` points)
- Test: `frontend/src/lib/__tests__/washer.test.ts`, `backend/tests/test_washer.py`
- Modify: `frontend/src/store/types.ts` (add `Washer { id: string; wallId: string; positionMm: number }`; `PlumbingPoint.washerId?: string`)

**Interfaces:**
- Produces (TS): `WASHER_W_MM = 600`, `WASHER_D_MM = 600`, `WASHER_H_MM = 850`; `washerPoints(washers: readonly Washer[], geometry): PlumbingPoint[]` (ids `${id}:cold`, `${id}:drain`, carry `washerId`); `withWasherPoints(points, washers, geometry): PlumbingPoint[]` (same list when none); `washerSpans(geometry, wallId, others: Array<{ wallId: string; positionMm: number; halfMm: number }>): Array<[number, number]>`; `nearestFreeWasher(geometry, wallId, positionMm, others, stayNearMm?): number | null`; `placeWasher(geometry, riser: RiserAt, others, taken: Rect[]): { wallId: string; positionMm: number } | null`; `keepWashers(washers, geometry, rails: readonly TowelRail[]): Washer[]`; `saneWashers(saved: unknown): Washer[]`.
- Produces (Py): `valid_washers(washers, geometry) -> list[dict]`, `washer_points(washers, geometry) -> list[dict]` (same ids, keys and `washerId`).

- [ ] **Step 1: Write the failing tests**
  - Shared fixture, both sides: for each case `washerPoints` / `washer_points` equals `expected` (cases: mid wall A; near a wall's start so a point clamps to 0; a machine on a wall the room lacks gives none; a polygon room).
  - TS `washerSpans`: a 2500 mm wall with a 700 mm door at 650 leaves no centre within 300 mm of the door; a rail at 1800 (`halfMm` 250) blocks centres within 550 mm of 1800.
  - TS `placeWasher`: on the riser's wall nearest the riser; with `taken` holding a box over that spot, the next free place whose 600 × 600 floor box (centre 320 mm off the wall) overlaps nothing; a second machine with the first in `others` does not overlap it; a room too small returns null.
  - TS `keepWashers`: a shorter wall pulls it in; a new door on its place moves it to the nearest free place; a shape without its wall drops it; unchanged input returns the same array.
  - TS `saneWashers`: drops non-objects, missing id/wallId, non-finite position.
- [ ] **Step 2: Run** `npx vitest run src/lib/__tests__/washer.test.ts` and `pytest tests/test_washer.py` — Expected: FAIL (modules missing).
- [ ] **Step 3: Implement.** `washerSpans` is `towelRail.freeSpans` with half-width 300 mm, less each `others` entry on the same wall widened by its `halfMm` + 300. Make `freeSpans` take an optional `halfMm` (default 250) rather than copying it. `placeWasher` walks candidates by pipe run to the riser (as `placeTowelRail` does, every 50 mm within spans) and takes the first whose floor box passes `overlaps` (lib/aiDesignLayout) against `taken`. Backend mirrors only `valid_washers` and `washer_points` (the estimate never places).
- [ ] **Step 4: Run** both — Expected: PASS.
- [ ] **Step 5: Commit** `feat(washer): the machine's points and where it may stand`.

### Task 2: The machine in the store and the saved room

**Files:**
- Create: `frontend/src/store/slices/washerSlice.ts`
- Modify: `frontend/src/store/roomStore.ts` (slice, `RoomTemporalState`, persist), `frontend/src/store/roomStoreTypes.ts`, `frontend/src/store/slices/lifecycleSlice.ts` (load `saneWashers`, reset `[]`), `frontend/src/store/slices/geometrySlice.ts` (`keepWashers` wherever `keepRails` runs), `frontend/src/lib/autosave.ts` (`'washers'` in `ROOM_CONTENT_KEYS`), `frontend/src/pages/studio/StudioPage.tsx` (save `washers`)
- Test: `frontend/src/store/__tests__/washerSlice.test.ts`

**Interfaces:**
- Consumes: Task 1.
- Produces: `washers: Washer[]`; `addWasher(): boolean` (false when `placeWasher` finds no place; uses `roomRiser(geometry, plumbingRiser)`, other washers and towel rails as `others`, furniture boxes as `taken`); `moveWasher(id, positionMm)` (via `nearestFreeWasher` with `stayNearMm` while dragging); `removeWasher(id)`; `beginWasherDrag()` / `endWasherDrag()` (one undo step, as `towelRailSlice`).
- Furniture boxes: move the `placed` computation out of `features/studio/nextFurnitureSpot.ts` into an exported `placedFurnitureBoxes(state): PlacedBox[]` and use it in both places.

- [ ] **Step 1: Failing tests** (mirroring `towelRailSlice.test.ts`): add puts one where `placeWasher` says and marks dirty; add with no room returns false and adds nothing; drag stops at a door's edge and is one undo step; undo/redo of add; remove; `setWallLength` / `addElement` / `applyRoomShape` run `keepWashers`; `loadDraftState` brings `washers`, a room saved before has none, `resetRoom` clears; `roomContentChanged` sees a change.
- [ ] **Step 2: Run** `npx vitest run src/store/__tests__/washerSlice.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** the slice and wire-up above.
- [ ] **Step 4: Run** the slice test and `src/features/studio` tests — Expected: PASS.
- [ ] **Step 5: Commit** `feat(washer): the machine in the room store, saved with the room`.

### Task 3: The machine in 3D and in the panel

**Files:**
- Create: `frontend/src/pages/studio/three-d/Washers3D.tsx`
- Modify: `frontend/src/pages/studio/three-d/ThreeDCanvasScene.tsx` (mount beside `TowelRails3D`), `frontend/src/pages/studio/three-d/PlumbingPoints3D.tsx` (points `withWasherPoints` after rails; a `washerId` point is not draggable), `frontend/src/components/studio/design-panel/SantexnikaSection.tsx` (points with washers; "(machine's)" tag; a "Washing machine" block: add button, row per machine `wall N` + Remove, no-room message), `frontend/src/i18n/locales/{uz,ru,en}.json` (`studio.santexnika.washer`, `washer_add`, `washer_own`, `washer_no_room`)
- Test: `frontend/src/pages/studio/three-d/__tests__/washers3D.test.ts`, `frontend/src/components/studio/design-panel/SantexnikaSection.test.tsx`

**Interfaces:**
- Consumes: Tasks 1–2; `raycastInFront`, `railPointerHandlers`, `dragToPositionMm` from `TowelRails3D.tsx`.
- Produces: `washerPose(w: Washer, geometry): { x: number; y: number; z: number; rotY: number } | null` (box centre: 320 mm off the wall, y = 425 mm).

- [ ] **Step 1: Failing tests:** `washerPose` on wall B at 800 is at the wall walk point + normal × 0.32, y 0.425; null on a missing wall. Panel (uz): "Kir yuvish mashinasi qo'shish" adds one and lists "… devor"; its two points are listed with "(mashinaniki)" and no Remove; Remove drops the machine and its points; in a kitchen the block is shown; the summary's water count rises by 1 and drain count by 1.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement.** The box: white `#F5F5F4`, door a dark circle (r 0.2 m) on the front at y 0.5 m. Drag only in the Santexnika stage, as `TowelRails3D` (plane of the wall, `moveWasher`, `beginWasherDrag`/`endWasherDrag`, cleanup on unmount). Hidden when its wall is in `hiddenWalls`.
- [ ] **Step 4: Run** these tests and `npx tsc -b` — Expected: PASS, clean.
- [ ] **Step 5: Commit** `feat(washer): drawn in 3D, slid along its wall, listed in the panel`.

### Task 4: The machine in the estimate

**Files:**
- Modify: `backend/app/services/smeta.py` (`_plumbing_lines`: a point with `washerId` in saved `plumbing` is ignored, like `railId`; `points += washer_points(...)`; after the fixture parts, per machine `Kir yuvish mashinasi krani` and `Kir yuvish mashinasi sifoni` via `_piece_line(..., qty=n, why=f"{n} mashina")`, and `Ish: kir yuvish mashinasini ulash` `{n} dona × 150 000 so'm`), `backend/app/data/plumbing_norms.json` (`part_uzs.kran_kir`, `part_uzs.sifon_kir`, `work_washer_uzs`), `backend/app/services/smeta_keys.py`, `backend/app/services/estimate_catalog.py`, `frontend/src/lib/api/adminMaterials.ts`, locales (`smeta.line.washer_tap`, `washer_trap`, `work_washer`; `smeta.formula.mashina_*` plurals; `dokon.admin.smeta_key.kran_kir`, `sifon_kir`), `smetaLineText.ts` / `smeta_text.py` (labels; `mashina` in the counted words and both unit regexes)
- Test: `backend/tests/test_smeta_washer.py`, `backend/tests/test_estimate_catalog.py`, `frontend/src/lib/__tests__/smetaLineText.test.ts`

- [ ] **Step 1: Failing tests:** one machine gives the tap (1, 60 000, approximate), the trap (1, 70 000), the work (1, 150 000); two machines give 2 of each and formula `2 mashina = 2 dona × 60 000 so'm`; a tagged shop `kran_kir` gives its price and name; the machine's cold and drain points raise `Suv rozetkasi Ø20` by 1 and the pipe lengths; a stray `washerId` point in `plumbing` is not counted twice; no `washers` key gives the same lines as before; labels and `1 mashina` / `2 mashina` read in ru/en on both sides.
- [ ] **Step 2: Run** `pytest tests/test_smeta_washer.py` and the TS text test — Expected: FAIL.
- [ ] **Step 3: Implement** as listed; refresh `smeta_locale.json`.
- [ ] **Step 4: Run** those and `tests/test_smeta_text.py tests/test_estimate_catalog.py`, `adminMaterials` tests — Expected: PASS.
- [ ] **Step 5: Commit** `feat(washer): its tap, trap and connection in the estimate`.

### Task 5: The floor drain

**Files:**
- Modify: `backend/app/services/smeta.py` (`_fixture_part_lines` gets `floor_drain: bool`; with it, each shower's `sifon_dush` becomes `trap_pol` labelled `Pol trapi`, and `Ish: trap o'rnatish` `{n} dona × 200 000 so'm` is added; read `_design_state(room).get("floorDrain") is True`), norms (`part_uzs.trap_pol`, `work_floor_drain_uzs`), keys/catalog/admin as Global Constraints, `frontend/src/store/types.ts` (`floorDrain?: boolean`), `SantexnikaSection.tsx` (switch "Dush poddonsiz (pol trapi)", shown only when the room has a shower fixture), locales (`studio.santexnika.floor_drain`, `smeta.line.floor_drain`, `work_floor_drain`, `dokon.admin.smeta_key.trap_pol`), text maps
- Test: `backend/tests/test_smeta_floor_drain.py`, `SantexnikaSection.test.tsx`, `smetaLineText.test.ts`

- [ ] **Step 1: Failing tests:** off by default (None, `{}`, `False`, `"yes"`): `Dush poddoni sifoni` as before, no drain lines; on with one shower tray: no tray trap, `Pol trapi` 1 at 450 000 approximate, work 1 at 200 000, shower mixer unchanged; on with a shower cabin: the same swap; on with two showers: 2 and 2; on with no shower: nothing added; a tagged shop `trap_pol` gives its price. Panel: switch absent with no shower, present and unticked with one, ticking sets `designState.floorDrain` true. Text ru/en both sides.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement** as listed; refresh `smeta_locale.json`.
- [ ] **Step 4: Run** those — Expected: PASS.
- [ ] **Step 5: Commit** `feat(plumbing): a floor drain for a shower with no tray`.

### Task 6: Checklist and the whole suite

**Files:**
- Create: `docs/qa/2026-11-13-kir-yuvish-trap-mobil-tekshiruv.md` (machine in 3D ⭐: placing, sliding, door edge, undo; panel; points and summary; estimate lines ru/en and PDF; floor drain switch and lines; old rooms; reset afterwards)

- [ ] **Step 1:** Write the checklist (Uzbek, as the earlier ones).
- [ ] **Step 2: Run** the whole frontend suite, `npx tsc -b` (then delete the build artifacts), and the whole backend suite — Expected: all pass.
- [ ] **Step 3: Commit** `docs(qa): washing machine and floor drain, mobile checklist`.
