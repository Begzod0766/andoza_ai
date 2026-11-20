# Bathroom Plumbing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bathroom fixtures that place themselves sensibly, drain and water points they bring along (plus hand-added ones), and a "Santexnika" section in the estimate.

**Architecture:**
- Plumbing fixtures become five furniture roles, with placement rules of their own.
- Points are a new list in room state, `plumbing`, beside `electricals`. A store slice keeps each fixture's own points in step with the fixture.
- One pipe-run rule (walk the walls to the riser) exists in TypeScript, for the stage's summary, and in Python, for the estimate. Shared fixtures in the tests keep the two equal.
- The estimate gets a `santexnika` group.

**Tech Stack:** React + zustand + react-three-fiber, vitest; FastAPI, SQLAlchemy async, pytest.

**Spec:** `docs/superpowers/specs/2026-11-08-hammom-santexnika-design.md`

## Global Constraints

- Ship as **three PRs**: Tasks 1–3, Tasks 4–8, Tasks 9–12. Each PR must be useful on its own.
- `inferRole` (`frontend/src/lib/furnitureRole.ts`) and `infer_role` (`backend/app/services/ai_designer.py`) stay identical.
- Every new string in `frontend/src/i18n/locales/{uz,ru,en}.json`. The parity test must pass. Backend estimate text goes in `backend/app/data/smeta_locale.json`.
- A room saved before this work has no `plumbing` key. It must load as `[]` and estimate without error.
- Point kinds are `'drain' | 'cold' | 'hot'`. Pipe reserve is ×1.15. Fittings are one set per point.
- After `npx tsc -b`, delete `frontend/vite.config.js`, `vite.config.d.ts` and `tsconfig*.tsbuildinfo`.
- Commit trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A scanned or drawn room** has walls `"0".."n"` or `W1..Wn`, not A–D. Pipe runs and point placement must walk those walls. Test in Task 6 and Task 9.
2. **A room with no riser and no door.** The riser falls back to the start of the first wall. It must not crash or produce NaN. Test in Task 6 and Task 9.
3. **A fixture turned or moved onto another wall.** Its points move to the wall now behind it. Test in Task 5.
4. **Undo and redo** restore the points with the fixture. `plumbing` must be in the temporal state. Test in Task 5.
5. **A kitchen sink.** In `oshxona`, the stage shows and the sink brings its points. Test in Task 7.

---

## PR 1: Fixtures

### Task 1: Fixture roles

**Files:**
- Modify: `frontend/src/lib/furnitureRole.ts` (the `FurnitureRole` union, `ROLE_GROUP`, `GroupId`, name rules)
- Modify: `frontend/src/lib/furnitureRoomFit.ts` (`ROOM_ROLES`)
- Modify: `backend/app/services/ai_designer.py` (`FURNITURE_ROLES`, `_ROLE_BY_NAME`)
- Test: `frontend/src/lib/__tests__/furnitureRole.test.ts`, `frontend/src/lib/__tests__/furnitureRoomFit.test.ts`, `backend/tests/test_ai_designer.py`

**Interfaces:**
- Produces: `FurnitureRole` adds `'bathtub' | 'sink' | 'toilet' | 'shower' | 'bidet'`. `GroupId` adds `'plumbing'`. `ROLE_GROUP[r] === 'plumbing'` for those five. Python `infer_role` returns the same strings.

- [ ] **Step 1: Write the failing tests.**
  - `it.each` over names to roles:
    - `'Vanna 1'`, `'Ванна акриловая'`, `'Bathtub'` give `bathtub`;
    - `'Rakovina 3'`, `'Раковина'`, `'Umivalnik'` give `sink`;
    - `'Unitaz'`, `'Унитаз'` give `toilet`;
    - `'Dush 2'`, `'Душевая кабина'` give `shower`;
    - `'Bide'`, `'Биде'` give `bidet`.
  - Each is checked with `category: 'boshqa'`.
  - `fitsCatalogRoom` with no `room_type`: `Vanna` is offered in `hammom` and not in `mehmonxona`. `Rakovina` is offered in `oshxona`.
  - Python: the same name table, parametrized.
- [ ] **Step 2: Run the tests; expect failures.**
  - `cd frontend && npx vitest run src/lib/__tests__/furnitureRole.test.ts src/lib/__tests__/furnitureRoomFit.test.ts`
  - `cd backend && pytest tests/test_ai_designer.py -k role -q`
- [ ] **Step 3: Implement.**
  - Put the plumbing name rules **before** the existing rules, so "Ванна" never matches a later rule. Use the same regexes on both sides.
  - In `ROOM_ROLES`, `hammom` gets all five roles and `oshxona` adds `sink`.
- [ ] **Step 4: Run Step 2 again; expect a pass.** Also run the AI designer suites (`pytest tests -k ai_design -q`). A new role must not reach the AI menu as an unknown role.
- [ ] **Step 5: Commit.** `feat(roles): bathtub, sink, toilet, shower and bidet roles`

### Task 2: Placement rules for fixtures

**Files:**
- Modify: `frontend/src/lib/placement.ts` (`freeFurnitureSpotMm`)
- Test: `frontend/src/lib/__tests__/placement.test.ts`

**Interfaces:**
- Consumes: the Task 1 roles.
- Produces: `freeFurnitureSpotMm(geometry, placed, sizeM, role)`, with the same signature, now handling the plumbing roles. It returns `{ x, y, rotation, onWall?: boolean }`.

- [ ] **Step 1: Write the failing tests.** Room: 2.5 × 2.0 m, A–D, a 0.7 m door on wall D.
  - `bathtub` 1.7 × 0.7: on the longest wall (A or C); its long side is parallel to that wall; `onWall: true`; it doesn't overlap the door's 0.8 m swing zone.
  - `shower` 1.0 × 1.0: its centre is within 0.55 m of both walls of a corner, and that corner is the one farthest from the door's midpoint.
  - `toilet` and `sink` after the bathtub: each has its back to a wall, overlaps nothing placed, and keeps its front clearance free (0.6 m and 0.7 m).
  - `bidet` with a toilet placed: on the same wall, 0.3 ± 0.05 m from the toilet's edge.
  - All four, added in turn, overlap nothing. This is the prod pile-up case: positions (0,0), (300,300), (600,600) must not recur.
- [ ] **Step 2: Run the tests; expect failures.** `npx vitest run src/lib/__tests__/placement.test.ts`
- [ ] **Step 3: Implement.**
  - Add `PLUMBING_ROLES`.
  - `bathtub`, `sink`, `toilet` and `bidet` go through the existing wall search (the `WALL_ROLES` path), with a front clearance added to the size's depth while searching: sink 0.7 m, toilet 0.6 m.
  - `shower` tries `corner_<a>_<b>` zones, ordered by distance from the door (farthest first), using `furnitureSpot(zone, …)`.
  - `bidet` tries the toilet's wall first, at the toilet's side.
- [ ] **Step 4: Run Step 2 again, plus `npx vitest run src/lib`; expect a pass.**
- [ ] **Step 5: Commit.** `feat(placement): fixtures go against walls and into corners, never on top of each other`

### Task 3: Furniture panel room filter and "Santexnika" chip

**Files:**
- Modify: `frontend/src/components/studio/design-panel/MebelSection.tsx`
- Modify: locales (`studio.furn.filter_santexnika`: "Santexnika" / "Сантехника" / "Plumbing")
- Test: `frontend/src/components/studio/design-panel/MebelSection.test.tsx`

**Interfaces:**
- Consumes: `fitsCatalogRoom(item, roomTypeKey)` from `lib/furnitureRoomFit.ts`; `catalogRoomType(effectiveRoomType(roomType, name))` from `lib/roomType.ts`.

- [ ] **Step 1: Write the failing tests.**
  - With a store room of type `hammom` and a catalog holding `Vanna 1` (hammom), `Стол Nord` (no room) and `Divan 1` (mehmonxona), the "All" list shows only `Vanna 1`.
  - Pressing a chip named "Santexnika" shows only plumbing-role pieces.
  - In a room of no type, the list is unchanged (everything shows).
- [ ] **Step 2: Run the tests; expect failures.**
- [ ] **Step 3: Implement.** Filter the panel's catalog by `fitsCatalogRoom` when the room has a catalog type. Add the chip after "Lamp"; it matches `ROLE_GROUP[inferRole(c.category, c.name_uz)] === 'plumbing'`.
- [ ] **Step 4: Run the tests; expect a pass. Then run the full suite and `tsc -b`.**
- [ ] **Step 5: Commit, open PR 1, and after merge check "Hammom namunasi" on prod.** Add the four fixtures again; none overlap. Commit message: `feat(panel): the 3D models panel follows the room type, with a Santexnika filter`

## PR 2: Points

### Task 4: What each fixture needs, and its points

**Files:**
- Create: `frontend/src/lib/plumbingPoints.ts`
- Modify: `frontend/src/store/types.ts` (adds `PlumbingPoint`)
- Test: `frontend/src/lib/__tests__/plumbingPoints.test.ts`

**Interfaces:**
- Produces:
  - `type PlumbingKind = 'drain' | 'cold' | 'hot'`
  - `interface PlumbingPoint { id: string; kind: PlumbingKind; diameterMm?: 50 | 110 | 20; wallId: string; positionMm: number; heightMm: number; fixtureId?: string }`
  - `PLUMBING_NEEDS: Record<'bathtub'|'sink'|'toilet'|'shower'|'bidet', Array<{ kind: PlumbingKind; heightMm: number; diameterMm: number }>>`, with the spec's table. Drains: bathtub 50@150, sink 50@500, toilet 110@200, shower 50@0, bidet 50@200. Water: bathtub 700, sink 550, toilet cold only 200, shower 1050, bidet 250. Water pipes are diameter 20.
  - `fixturePoints(fixture: PlacedFurniture, role: FurnitureRole, sizeM: {w,d}, geometry: RoomGeometry): PlumbingPoint[]`. Points land on the wall the fixture's back faces, at the fixture's centre projected onto that wall. Cold sits 100 mm left of centre and hot 100 mm right. `fixtureId = fixture.id`. Ids are deterministic: `${fixture.id}:${kind}`.

- [ ] **Step 1: Write the failing tests.**
  - A bathtub against wall A in a 2.5 × 2.0 m room gives 3 points on `A`. The drain is at 150 mm. Cold and hot are 200 mm apart, centred on the bathtub's centre along A.
  - A toilet gives a Ø110 drain and cold water, no hot.
  - A shower gives a drain at `heightMm: 0`.
  - A polygon room with walls `"0".."3"`: points land on the wall behind the fixture (Review Focus 1).
  - A non-plumbing role gives `[]`.
- [ ] **Step 2: Run the tests; expect failures.**
- [ ] **Step 3: Implement.** Find the wall behind the fixture: take the fixture's back direction (opposite its front, `(sin r, cos r)`), cast it to the room outline with `roomModel(geometry).walls`, and choose the nearest wall whose inward normal is within 45° of the front. Clamp `positionMm` to the wall's length.
- [ ] **Step 4: Run the tests; expect a pass.**
- [ ] **Step 5: Commit.** `feat(plumbing): the drain and water points each fixture needs`

### Task 5: Plumbing slice, persistence, fixture sync

**Files:**
- Create: `frontend/src/store/slices/plumbingSlice.ts`
- Modify:
  - `frontend/src/store/roomStore.ts`: the slice, `RoomTemporalState`, `partializeTemporal`, persist;
  - `frontend/src/store/roomStoreTypes.ts`;
  - `frontend/src/store/slices/lifecycleSlice.ts`: load (`plumbing: s.plumbing ?? []`) and reset;
  - `frontend/src/pages/studio/StudioPage.tsx`: the saved state gets `plumbing`;
  - `frontend/src/lib/keepContent.ts`: if it lists the state keys.
- Test: `frontend/src/store/__tests__/plumbingSlice.test.ts`

**Interfaces:**
- Consumes: `fixturePoints` (Task 4).
- Produces:
  - store fields `plumbing: PlumbingPoint[]`;
  - `addPlumbing(p)`, `movePlumbing(id, { wallId?, positionMm?, heightMm? })`, `removePlumbing(id)`;
  - `syncFixturePoints()`. It replaces every point that has a `fixtureId` with `fixturePoints` for the fixtures now placed. Hand points (no `fixtureId`) are untouched.
  - `placeFurniture`, `moveFurniture`, `rotateFurniture` and `removeFurniture` call `syncFixturePoints()` after they change `furniture`. Use the existing furniture slice actions' names.

- [ ] **Step 1: Write the failing tests.**
  - Placing a bathtub adds its 3 points.
  - Moving it along the wall moves them.
  - Turning it onto another wall moves them to that wall (Review Focus 3).
  - Removing it removes them.
  - A hand-added point survives all of the above.
  - `loadRoom` with a state that has no `plumbing` key gives `[]`.
  - Undo after placing a bathtub removes the bathtub and its points; redo brings both back (Review Focus 4).
- [ ] **Step 2: Run the tests; expect failures.**
- [ ] **Step 3: Implement.** Mirror `electricalSlice`. Add `plumbing` wherever `electricals` appears in persistence and temporal state.
- [ ] **Step 4: Run the tests, then the full suite, then `tsc -b`; expect a pass.**
- [ ] **Step 5: Commit.** `feat(plumbing): points in room state, kept in step with their fixtures`

### Task 6: Riser and pipe runs (TypeScript)

**Files:**
- Create: `frontend/src/lib/plumbingRuns.ts`
- Create: `frontend/src/lib/__tests__/fixtures/plumbingRuns.json` (shared with Task 9)
- Test: `frontend/src/lib/__tests__/plumbingRuns.test.ts`

**Interfaces:**
- Produces:
  - `riserSpot(geometry, serviceFeatures?: ServiceFeature[]): { wallId: string; positionMm: number }`. It uses the riser from `riserBoxes`, projected onto its nearest wall. Otherwise it uses the corner at the start of the wall holding the first door. Otherwise it uses the start of the first wall.
  - `pipeRunM(geometry, from: {wallId, positionMm, heightMm}, riser: {wallId, positionMm}): number`. This is the shorter way around the perimeter between the two wall positions, plus `heightMm / 1000`. Rounded to 2 decimals.
  - `plumbingSummary(geometry, points, riser): { drain: { points: number; m: number }; water: { points: number; m: number } }`. Lengths include the ×1.15 reserve.
- The fixture file holds an array of `{ geometry, from, riser, expectedM }` cases: a rectangle A–D, a polygon `"0".."4"`, and a room with no door (Review Focus 1 and 2).

- [ ] **Step 1: Write the failing tests.**
  - Every case in the fixture file matches `expectedM` within 0.01.
  - `riserSpot` falls back to the door corner, then to the first wall.
  - A 4-point summary gives `m = sum × 1.15`.
- [ ] **Step 2: Run the tests; expect failures.**
- [ ] **Step 3: Implement.** Use cumulative wall lengths in `geometry.walls` order to put both points on one perimeter coordinate. The run is `min(|a-b|, P-|a-b|)` plus the height.
- [ ] **Step 4: Run the tests; expect a pass.**
- [ ] **Step 5: Commit.** `feat(plumbing): riser and pipe runs along the walls`

### Task 7: The "Santexnika" stage

**Files:**
- Modify: `frontend/src/lib/phases.ts` (`PhaseKey` adds `'santexnika'`; `RENO_STAGES` adds it after `montaj`)
- Create: `frontend/src/components/studio/design-panel/SantexnikaSection.tsx`
- Modify:
  - `frontend/src/components/studio/DesignPanel.tsx`: renders the section when `phase === 'santexnika'`;
  - the stage list component: shows the stage only for catalog room type `hammom` or `oshxona`;
  - locales: `studio.lib.stage.santexnika` and `studio.santexnika.*` (title, fixtures, points, add point, kind names, wall, height, summary).
- Test: `frontend/src/components/studio/design-panel/SantexnikaSection.test.tsx`, plus a stages test.

**Interfaces:**
- Consumes: store `plumbing`, `addPlumbing`, `movePlumbing`, `removePlumbing` (Task 5); `riserSpot`, `plumbingSummary` (Task 6).
- Produces: `visibleStages(roomKind: string | undefined): typeof RENO_STAGES`, exported from `lib/phases.ts`.

- [ ] **Step 1: Write the failing tests.**
  - `visibleStages('hammom')` and `visibleStages('oshxona')` include `santexnika`; `visibleStages('mehmonxona')` and `visibleStages(undefined)` don't.
  - The section lists the room's fixtures and points.
  - "+ Add point" with kind `cold`, wall `B` and height 900 adds a point with no `fixtureId`.
  - The summary reads "Kanalizatsiya: 2 nuqta, ~X m · Suv: 4 nuqta, ~Y m", with X and Y from `plumbingSummary`.
  - A kitchen with a sink lists 3 points (Review Focus 5).
- [ ] **Step 2: Run the tests; expect failures.**
- [ ] **Step 3: Implement.** Follow `MontajSection`'s layout and styles.
- [ ] **Step 4: Run the tests, then the full suite and `tsc -b`; expect a pass.**
- [ ] **Step 5: Commit.** `feat(plumbing): the Santexnika stage for bathrooms and kitchens`

### Task 8: Points in 3D, pipe lines, arc menu

**Files:**
- Create: `frontend/src/pages/studio/three-d/PlumbingPoints3D.tsx`
- Modify:
  - `frontend/src/pages/studio/three-d/ThreeDCanvasScene.tsx`: renders it;
  - `frontend/src/features/studio/useArcCategories.tsx`: adds a `santexnika` category with the room's fixtures and "add point";
  - locales.
- Test: `frontend/src/pages/studio/three-d/__tests__/plumbingPoints3D.test.ts`, covering the pure pose helper.

**Interfaces:**
- Consumes: Tasks 5 and 6.
- Produces:
  - `plumbingPointPose(point, geometry): { x: number; y: number; z: number; rotY: number }`, exported for tests;
  - colours: drain `#9CA3AF`, cold `#3B82F6`, hot `#EF4444`;
  - a disc of radius 0.04 m, standing 0.01 m off the wall.

- [ ] **Step 1: Write the failing tests.** `plumbingPointPose` for wall A position 1250 height 700 in a 2.5 × 2.0 m room returns the wall's midpoint at y 0.7, facing into the room. On a polygon room it uses the right wall.
- [ ] **Step 2: Run the tests; expect failures.**
- [ ] **Step 3: Implement.**
  - Discs are dragged the way `pages/studio/placement/Electrical3D.tsx` drags a socket: along the wall, and up or down. A drag calls `movePlumbing`.
  - Pipe lines run along the walls, 0.05 m above the floor, from each point to `riserSpot`. They are drawn only in the `santexnika` stage, behind a toggle in the section.
  - The arc category appears only when `visibleStages` includes `santexnika`.
- [ ] **Step 4: Run the tests, then the full suite and `tsc -b`; expect a pass.**
- [ ] **Step 5: Commit, open PR 2, and after merge check on prod.** In "Hammom namunasi", the points are visible and draggable, and the stage summary is shown. Commit message: `feat(plumbing): points on the walls in 3D, pipe runs, arc menu`

## PR 3: Estimate

### Task 9: Backend pipe runs and norms

**Files:**
- Create: `backend/app/services/plumbing.py`
- Create: `backend/app/data/plumbing_norms.json`
- Test: `backend/tests/test_plumbing.py`, which reads `frontend/src/lib/__tests__/fixtures/plumbingRuns.json`

**Interfaces:**
- Produces:
  - `riser_spot(geometry: dict, service_features: list | None) -> tuple[str, float]`
  - `pipe_run_m(geometry: dict, point: dict, riser: tuple[str, float]) -> float`
  - Both match the Task 6 rules. Wall lengths in saved geometry are in metres. Positions in `plumbing` are in mm.
  - `load_plumbing_norms() -> dict`, with keys:
    - `pipe_m_uzs`: `{"drain_50": 18000, "drain_110": 42000, "water_20": 9000}`
    - `fitting_set_uzs`: 35000
    - `work_point_uzs`: 120000
    - `work_fixture_uzs`: `{"bathtub": 450000, "sink": 250000, "toilet": 350000, "shower": 400000, "bidet": 300000}`

- [ ] **Step 1: Write the failing tests.** Every fixture case matches `expectedM` within 0.01; this is the same file Task 6 uses (Review Focus 1 and 2). The norms file loads and has every key.
- [ ] **Step 2: Run the tests; expect failures.** `pytest tests/test_plumbing.py -q`
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the tests; expect a pass.**
- [ ] **Step 5: Commit.** `feat(smeta): plumbing pipe runs and norms`

### Task 10: The estimate's "santexnika" lines

**Files:**
- Modify:
  - `backend/app/services/smeta.py`: a new `_plumbing_lines(room, catalog)`, called after `_furniture_lines`. `_furniture_lines` skips plumbing roles.
  - `backend/app/services/estimate_catalog.py`: loads the shop's `santexnika` pipe products by name (`Ø50`/`50 мм`, `Ø110`/`110`, `PPR`/`20`).
  - `backend/app/data/smeta_locale.json` and `backend/app/services/smeta_text.py` (`_LABEL_HEADS`/`_WHOLE_LABELS`): the new labels.
- Test: `backend/tests/test_smeta_plumbing.py`

**Interfaces:**
- Consumes: Task 9; `infer_role` (Task 1).
- Produces: lines with `category="santexnika"`. The labels are:
  - `"Santexnika: <name>"` for each fixture;
  - `"Kanalizatsiya quvuri Ø50"`, `"Kanalizatsiya quvuri Ø110"` and `"Suv quvuri PPR Ø20"`, quantities in metres;
  - `"Fitinglar"`, in sets;
  - `"Ish: nuqtani ulash"`, in points;
  - `"Ish: <fixture> o'rnatish"`, per fixture.

- [ ] **Step 1: Write the failing tests.** Room: a bathtub, a toilet and a sink in state `furniture`, with their points in `plumbing` and a riser.
  - The fixtures are in `santexnika` and not in `jihoz`.
  - The Ø50 metres equal the sum of the bathtub and sink drain runs × 1.15.
  - The Ø110 metres equal the toilet's run × 1.15.
  - The water metres equal the cold and hot runs × 1.15.
  - Fittings equal the point count.
  - Work equals points × 120 000 plus each fixture's norm.
  - With no shop pipe product, the pipe lines are `is_approximate` and priced from the norms. With one, the shop's price and name are used.
  - A room with no `plumbing` key still lists its fixtures under `santexnika` and no pipe lines.
  - `ru` and `en` labels come back translated.
- [ ] **Step 2: Run the tests; expect failures.**
- [ ] **Step 3: Implement.** Each line's formula shows its working, for example `"4 nuqta: 1.3 + 1.1 + 0.9 + 1.4 m × 1.15 = 5.5 m"`.
- [ ] **Step 4: Run the tests, then the full backend suite (`pytest -q --ignore=tests/test_room_scan_router.py`); expect a pass.**
- [ ] **Step 5: Commit.** `feat(smeta): a Santexnika section with fixtures, pipes, fittings and work`

### Task 11: Frontend estimate group

**Files:**
- Modify:
  - `frontend/src/lib/smetaGroups.ts`: `GroupKey` adds `"santexnika"`; it goes in `GROUP_ORDER` after `"elektr"`; `CATEGORY_TO_GROUP.santexnika = "santexnika"`; `GROUP_COLOUR.santexnika = "#0EA5E9"`.
  - `frontend/src/components/smeta/CategorySection.tsx`: the icon `Droplets`.
  - `frontend/src/lib/smetaLineText.ts`: the new labels.
  - Locales: `smeta.toifa.santexnika` is "Santexnika" / "Сантехника" / "Plumbing".
- Test: `frontend/src/lib/__tests__/smetaGroups.test.ts` and `smetaLineText.test.ts`.

- [ ] **Step 1: Write the failing tests.**
  - A line with `category: "santexnika"` groups under `santexnika`, which comes after `elektr`.
  - "Renovation only" (the excluded `jihoz` group) still counts `santexnika`.
  - The `ru` and `en` labels are translated.
- [ ] **Step 2: Run the tests; expect failures.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the tests, then the full suite and `tsc -b`; expect a pass.**
- [ ] **Step 5: Commit.** `feat(smeta): the Santexnika group on the estimate page`

### Task 12: Mobile checklist and prod check

**Files:**
- Create: `docs/qa/2026-11-08-santexnika-mobil-tekshiruv.md`

- [ ] **Step 1: Write the checklist.** It covers placement, points, dragging, the stage, the summary, and the estimate section with its PDF, in en and ru.
- [ ] **Step 2: Open PR 3. After merge, check on prod.** On the "Hammom namunasi" estimate, the Santexnika section has the fixtures, the three pipe lines with metres, the fittings and the work. Take screenshots on desktop and at 375 px.
- [ ] **Step 3: Commit.** `docs(qa): plumbing checklist for the mobile app`
