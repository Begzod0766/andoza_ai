# Heated Towel Rail and Extractor Fan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A bathroom's estimate lists an extractor fan automatically, and a user can hang a water-heated towel rail on a wall, see it in 3D and have it priced with its pipes.

**Architecture:** The fan is estimate-only, switched by `designState.ventFan`. A towel rail is a record in a new `towelRails` list beside `plumbing`; its two hot water points are derived from it on both sides by one rule (pinned by a shared fixture file) and join the existing plumbing lines and pipe runs. The studio draws the rail as a procedural ladder.

**Tech Stack:** FastAPI + SQLAlchemy (`backend/app`), pytest; React + zustand/zundo + react-three-fiber (`frontend/src`), vitest; i18next uz/ru/en.

**Spec:** `docs/superpowers/specs/2026-11-10-sochiq-quritgich-ventilyatsiya-design.md`

## Global Constraints

- Bathroom only: `_is_bathroom(room)` on the backend; on the frontend the room-type check the Santexnika panel is gated by.
- Rail size 500 × 800 mm; default bottom edge 1000 mm; default centre 600 mm from the riser.
- Rail points: two, `kind: "hot"`, `diameterMm: 20`, never saved in `plumbing`.
- `ventFan` is off only when it is exactly `false`.
- Fan cable: fixed 3 m.
- Norms (UZS): rail 650 000, rail work 200 000, fan 180 000, fan work 100 000, in `backend/app/data/bathroom_extras_norms.json`.
- Categories: rail lines `santexnika`; fan lines `ventilyatsiya` → group `elektr`. Never `elektr` for the fan.
- Every new `category` needs a group in `backend/app/services/smeta_groups.py` and `frontend/src/lib/smetaGroups.ts`.
- Every new label, formula word and warning: uz/ru/en in the locales, `smetaLineText.ts` and `smeta_text.py`; regenerate with `cd backend && python -m app.services.smeta_text ../frontend/src/i18n/locales`.
- New smeta keys go in `KEY_PACK_UNIT`/key validation **and** `frontend/src/lib/api/adminMaterials.ts` (sync test).
- TDD: each test written first and seen to fail. Stage named files only; never `docs/partners/*`.
- Commands. Backend: `cd backend && /Users/mac/.cache/andoza-bvenv/bin/python -m pytest <path> -q -p no:cacheprovider` (full suite adds `--ignore=tests/test_room_scan_router.py`). Frontend: `export PATH=~/.local/node/bin:$PATH; cd frontend && npx vitest run <path>`; `npx tsc -b`, then delete `vite.config.js vite.config.d.ts tsconfig.tsbuildinfo tsconfig.node.tsbuildinfo`.
- Commit trailer: `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`.

## Review Focus

1. A rail whose `wallId` is not in the room (stale after a reshape, or bad data): the estimate skips it, no crash, no pipe line for it.
2. A rail saved with a position past its wall's end: its points are clamped inside the wall, on both sides alike.
3. A room with saved `plumbing: []` and one rail: the plumbing lines still appear (the `if points` gate must see rail points).
4. A bathroom in the "repair only" view: fan and rail lines stay in the total.
5. `ventFan` set to `null`, `0` or a string: the fan stays on.

Each has a test in the task that owns the code (Tasks 1, 3, 4).

---

## PR 1: the extractor fan (branch `feat/vent-fan`)

### Task 1: Fan lines in the estimate

**Files:**
- Create: `backend/app/data/bathroom_extras_norms.json`, `backend/app/services/bathroom_extras.py`, `backend/tests/test_smeta_vent_fan.py`
- Modify: `backend/app/services/smeta.py`, `backend/app/services/smeta_keys.py`, `backend/app/services/smeta_groups.py`, `backend/app/services/smeta_text.py`, `backend/app/services/smeta_locale.json` (generated), `frontend/src/lib/smetaGroups.ts`, `frontend/src/lib/smetaLineText.ts`, `frontend/src/lib/api/adminMaterials.ts`, `frontend/src/i18n/locales/{uz,ru,en}.json`

**Interfaces:**
- Produces: `load_bathroom_extras_norms() -> dict` with keys `towel_rail_uzs`, `work_towel_rail_uzs`, `fan_uzs`, `work_fan_uzs`, `fan_cable_m` (3). `_fan_lines(room, catalog: dict, norms_map: dict) -> list[ComputedLine]`. `EXTRAS_NORM_NOTE` (the approximate-price warning). Smeta keys `ventilyator` and `sochiq_quritgich` (both valid only with `unit == "dona"`).

- [ ] **Step 1: Write the failing tests** in `test_smeta_vent_fan.py` (room built as in `tests/test_smeta_waterproofing.py`):

```python
def test_a_bathroom_gets_a_fan_its_cable_and_the_work():
    got = by_label(_fan_lines(room(), {}, {}))
    fan = got["Tortuvchi ventilyator"]
    assert (fan.qty, fan.unit, fan.unit_price_uzs, fan.category) == (1, "dona", 180_000, "ventilyatsiya")
    assert fan.is_approximate and fan.warning == EXTRAS_NORM_NOTE
    cable = got["Elektr kabel (ventilyator)"]
    assert (cable.qty, cable.unit) == (3, "m") and cable.category == "ventilyatsiya"
    work = got["Ish: ventilyatorni o'rnatish"]
    assert (work.qty, work.unit, work.unit_price_uzs) == (1, "dona", 100_000)

@pytest.mark.parametrize(("room_type", "name", "fan"), [("hammom", "Xona", True), (None, "Hammom", True), ("mehmonxona", "Hammom", False), (None, "Zal", False)])
def test_only_a_bathroom_gets_a_fan(room_type, name, fan): ...

@pytest.mark.parametrize(("value", "fan"), [(False, False), (True, True), (None, True), (0, True), ("false", True)])
def test_the_fan_is_off_only_when_ventFan_is_false(value, fan): ...   # and a designState with no ventFan key: on

def test_a_tagged_shop_fan_gives_its_price_name_and_shop(): ...        # label "Tortuvchi ventilyator: <name>", not approximate
def test_a_shop_cable_prices_the_fan_cable(): ...                      # catalog["kabel"] sold by the metre
def test_the_fan_does_not_switch_on_the_wiring_notice():
    assert compute_estimate(room(), {}, {}, catalog={}).has_electrical is False
def test_the_fan_lines_sit_in_the_electrics_group(): ...               # group_key_for(line) == "elektr"
def test_labels_and_the_cable_formula_read_in_russian_and_english(): ...
#   "Tortuvchi ventilyator" → "Вытяжной вентилятор" / "Extractor fan"
#   "Elektr kabel (ventilyator)" → "Электрокабель (вентилятор)" / "Electric cable (fan)"
#   "Ish: ventilyatorni o'rnatish" → "Работа: установка вентилятора" / "Work: fitting the extractor fan"
def test_the_new_keys_are_sold_by_the_piece():
    assert smeta_key_problem("ventilyator", "dona", None, None) is None
    assert smeta_key_problem("ventilyator", "m", None, None) is not None
    assert smeta_key_problem("sochiq_quritgich", "dona", None, None) is None
```

- [ ] **Step 2: Run** `pytest tests/test_smeta_vent_fan.py`. Expected: FAIL (ImportError `_fan_lines`).
- [ ] **Step 3: Implement.** Norms file and loader (as `tile_work.load_tile_norms`). In `smeta_keys.py` a `PIECE_KEYS = frozenset({"ventilyator", "sochiq_quritgich"})` joined into `ALL_SMETA_KEYS`, checked like `LIGHT_KEYS`. `_fan_lines`: nothing unless `_is_bathroom(room)` and `_design_state(room).get("ventFan") is not False`; fan from `catalog.get("ventilyator")` (unit `dona`) else norm; cable formula `"3 m (eng yaqin chiroq liniyasigacha, taxminiy)"`, price resolved as `_electrical_lines` does (shop `kabel` per metre, else the `elektr_kabel` norm's `price_per_m_uzs`, else `ELEC_CABLE_PRICE_UZS`), approximate; work at the norm. Call it from `compute_estimate` after the electrical lines. `CATEGORY_TO_GROUP["ventilyatsiya"] = "elektr"` on both sides. Text keys `fan`, `fan_cable`, `work_fan`, `extras_norm` and `dokon.admin.smeta_key.{ventilyator,sochiq_quritgich}` in the three locales; maps in `smeta_text.py` and `smetaLineText.ts`; both keys in `adminMaterials.ts`; regenerate `smeta_locale.json`.
- [ ] **Step 4: Run** the new file, then the full backend suite and `npx vitest run src/lib`. Expected: PASS. Estimate fixture tests that count a bathroom's lines grow by 3: update the counts, nothing else.
- [ ] **Step 5: Commit** `feat(smeta): extractor fan in every bathroom's estimate`.

### Task 2: The fan switch in the plumbing panel

**Files:**
- Modify: `frontend/src/store/types.ts` (`DesignState.ventFan?: boolean`), `frontend/src/components/studio/design-panel/SantexnikaSection.tsx`, locales (`studio.santexnika.fan`)
- Test: `frontend/src/components/studio/design-panel/SantexnikaSection.fan.test.tsx`

**Interfaces:**
- Consumes: `setDesignState(patch)` (designSlice); the room-type check the panel is gated by (find it where `SantexnikaSection` is mounted and reuse it as a prop or selector `isBathroom`).

- [ ] **Step 1: Failing tests:** in a bathroom the checkbox "Tortuvchi ventilyator" is shown and checked when `ventFan` is absent; unticking writes `designState.ventFan === false` and marks the store dirty; ticking again writes `true`; in a kitchen the checkbox is not shown.
- [ ] **Step 2: Run.** Expected: FAIL (no checkbox).
- [ ] **Step 3: Implement** the checkbox under the pipe-runs toggle: `checked={designState.ventFan !== false}`, `onChange → setDesignState({ ventFan: e.target.checked })`.
- [ ] **Step 4: Run** the file and `npx tsc -b`. Expected: PASS, clean.
- [ ] **Step 5: Commit** `feat(studio): switch for the bathroom's extractor fan`. Push, open PR 1 against `master`.

---

## PR 2: the towel rail in the estimate (branch `feat/towel-rail-estimate`, on PR 1)

### Task 3: The rail's points, one rule on both sides

**Files:**
- Create: `frontend/src/lib/towelRail.ts`, `frontend/src/lib/__tests__/towelRail.test.ts`, `frontend/src/lib/__tests__/fixtures/towelRailPoints.json`, `backend/app/services/towel_rail.py`, `backend/tests/test_towel_rail.py`
- Modify: `frontend/src/store/types.ts`

**Interfaces:**
- Produces (types.ts): `interface TowelRail { id: string; wallId: string; positionMm: number; heightMm: number }`; `PlumbingPoint.railId?: string`.
- Produces (towelRail.ts): `TOWEL_RAIL_W_MM = 500`, `TOWEL_RAIL_H_MM = 800`, `TOWEL_RAIL_HEIGHT_MM = 1000`, `TOWEL_RAIL_RISER_GAP_MM = 600`; `towelRailPoints(rail: TowelRail, wallLengthMm: number): PlumbingPoint[]`; `railPoints(rails: readonly TowelRail[], geometry: RoomGeometry): PlumbingPoint[]` (rails on a wall the room does not have give nothing).
- Produces (towel_rail.py): `towel_rail_points(rail: dict, wall_length_mm: float) -> list[dict]`; `rail_points(rails: object, geometry: dict | None) -> list[dict]` (same rule; tolerates a non-list and non-dict entries); `valid_rails(rails: object, geometry: dict | None) -> list[dict]`.
- Rule: feed `{id: f"{rail.id}:feed", positionMm: round(clamp(pos − 250, 0, L))}`, return `{id: f"{rail.id}:return", positionMm: round(clamp(pos + 250, 0, L))}`; both `kind "hot"`, `diameterMm 20`, `wallId`, `heightMm = rail.heightMm`, `railId = rail.id`. Wall length from `wallWalk` / `_room_walls` (mm). Rounding as `plumbingPoints` does (JS round; backend `_js_round`).

- [ ] **Step 1: Write the fixture and both failing tests.** `towelRailPoints.json`: cases `{name, geometry, rails, expected}` for an A–D room (rail mid-wall), a rail 100 mm from a wall's start (feed clamped to 0), a rail past the wall's end (both clamped to L), a polygon room with walls `"0".."4"`, a rail on wall `"Z"` (expected `[]`), two rails. Both tests load the same file and assert `railPoints` / `rail_points` equal `expected`. Backend adds: `rail_points(None, g) == []`, `rail_points([1, "x", {}], g) == []`.
- [ ] **Step 2: Run both.** Expected: FAIL (modules missing).
- [ ] **Step 3: Implement** both sides.
- [ ] **Step 4: Run both.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(plumbing): towel rail points, one rule for studio and estimate`.

### Task 4: Rail lines in the estimate

**Files:**
- Modify: `backend/app/services/smeta.py`, `backend/app/services/smeta_text.py`, `backend/app/services/smeta_locale.json`, `frontend/src/lib/smetaLineText.ts`, locales
- Test: `backend/tests/test_smeta_towel_rail.py`

**Interfaces:**
- Consumes: `rail_points`, `valid_rails` (Task 3); `load_bathroom_extras_norms`, `EXTRAS_NORM_NOTE` (Task 1).
- Changes `_plumbing_lines`: `points` = the saved-or-derived points **plus** `rail_points(state.get("towelRails"), geometry)`; after the fixture lines, one `Sochiq quritgich` line with `qty = len(valid_rails(...))`; with the fixture work lines, `Ish: sochiq quritgichni o'rnatish`.

- [ ] **Step 1: Failing tests:**

```python
def test_a_rail_adds_the_rail_its_pipe_fittings_and_work():
    got = by_label(_plumbing_lines(room(rails=[RAIL]), {}))
    assert (got["Sochiq quritgich"].qty, got["Sochiq quritgich"].unit_price_uzs) == (1, 650_000)
    assert got["Sochiq quritgich"].is_approximate and got["Sochiq quritgich"].warning == EXTRAS_NORM_NOTE
    assert got["Fitinglar"].qty == 2 and got["Ish: nuqtani ulash"].qty == 2
    assert got["Suv quvuri PPR Ø20"].formula.startswith("2 nuqta: ")
    assert got["Ish: sochiq quritgichni o'rnatish"].unit_price_uzs == 200_000

def test_the_pipe_run_is_measured_to_the_riser(): ...        # qty == round2((run(feed) + run(return)) * 1.15), via pipe_run_m
def test_two_rails_count_twice(): ...                        # rail qty 2, fittings 4
def test_rail_points_join_saved_points(): ...                # state["plumbing"] = [one cold point] → fittings 3
def test_a_room_with_saved_empty_plumbing_and_a_rail_still_gets_the_lines(): ...   # state["plumbing"] = []
def test_rail_points_join_derived_points(): ...              # no "plumbing" key, a bathtub placed → fittings 3 + 2
def test_a_rail_on_a_wall_the_room_does_not_have_is_skipped(): ...   # no rail line, no pipe line, no crash
def test_a_tagged_shop_rail_gives_its_price_name_and_shop(): ...     # catalog["sochiq_quritgich"], label "Sochiq quritgich: <name>"
def test_no_rails_no_change(): ...                           # lines equal to those of the same room without the key
def test_a_polygon_room(): ...                               # walls "0".."4"
def test_labels_read_in_russian_and_english(): ...
#   "Sochiq quritgich" → "Полотенцесушитель" / "Heated towel rail"
#   "Ish: sochiq quritgichni o'rnatish" → "Работа: установка полотенцесушителя" / "Work: fitting the towel rail"
def test_rail_and_fan_lines_stay_in_a_repair_only_total(): ...   # the filter the page uses for "repair only" keeps categories santexnika and ventilyatsiya
```

- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** as the Interfaces block says; text keys `towel_rail`, `work_towel_rail` on both sides; regenerate the locale json.
- [ ] **Step 4: Run** the file, `tests/test_smeta_plumbing.py`, then the full backend suite. Expected: PASS.
- [ ] **Step 5: Commit** `feat(smeta): heated towel rail with its pipes and work`. Push, open PR 2 against `feat/vent-fan`.

---

## PR 3: the towel rail in the studio (branch `feat/towel-rail-studio`, on PR 2)

### Task 5: Where a rail goes

**Files:**
- Modify: `frontend/src/lib/towelRail.ts`, `frontend/src/lib/__tests__/towelRail.test.ts`

**Interfaces:**
- Produces: `freeSpans(geometry, wallId): Array<[number, number]>` (walk mm along the wall where a 500 mm rail's centre may sit: the wall less 250 mm at each end and less each door and window widened by 250 mm each side); `nearestFree(geometry, wallId, positionMm): number | null`; `placeTowelRail(geometry: RoomGeometry, riser: { wallId: string; positionMm: number }): { wallId: string; positionMm: number } | null`; `keepRails(rails: readonly TowelRail[], geometry: RoomGeometry): TowelRail[]`.
- An opening's place along the walk: its `position` (0–1 centre fraction along the wall's own direction) turned to walk mm; reversed when the walk runs against the wall's direction (compare `wallWalk` with the wall's own start as `plumbingPointPose` and `fixturePoints` do).

- [ ] **Step 1: Failing tests:** free room beside the riser → riser wall, 600 mm from the riser, on the side that has room; a door covering that place → the nearest free centre on the same wall; a riser wall shorter than 500 mm → the next wall round the room; a room with no walls → `null`; `nearestFree` clamps a position past the wall's end to `L − 250` and moves one inside a window to its nearer edge; `keepRails` drops a rail whose wall is gone and pulls back one on a wall made shorter; a polygon room.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(studio): placing rule for a towel rail`.

### Task 6: The rails in the store, saved and loaded

**Files:**
- Create: `frontend/src/store/slices/towelRailSlice.ts`, `frontend/src/store/slices/__tests__/towelRailSlice.test.ts`
- Modify: `frontend/src/store/roomStore.ts` (slice, `partializeTemporal`, persist `partialize`), `frontend/src/store/roomStoreTypes.ts`, `frontend/src/store/slices/lifecycleSlice.ts` (load `towelRails ?? []`, reset `[]`), `frontend/src/store/slices/geometrySlice.ts` (`towelRails: keepRails(...)` wherever `plumbing` is recomputed), `frontend/src/lib/autosave.ts` (`'towelRails'` in `ROOM_CONTENT_KEYS`), `frontend/src/pages/studio/StudioPage.tsx` (save payload and load)

**Interfaces:**
- Produces: `towelRails: TowelRail[]`; `addTowelRail(): boolean` (places by `placeTowelRail(geometry, riserSpot(geometry))`, `false` when there is no place); `moveTowelRail(id: string, positionMm: number): void` (through `nearestFree`; ignored when it gives `null`); `removeTowelRail(id: string): void`; `beginTowelRailDrag()` / `endTowelRailDrag()` (one undo step, as `beginPlumbingDrag`).

- [ ] **Step 1: Failing tests:** add puts one rail at the placing rule's spot and marks dirty; add in a room with no walls returns `false` and adds nothing; move keeps off a door; remove; undo after add removes it and redo brings it back; a drag of several moves is one undo step; a geometry change that removes the wall removes the rail; `roomContentChanged` sees a `towelRails` change; loading a room state with `towelRails` fills the store and one without gives `[]`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `src/store`, `src/lib/__tests__/autosave*`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(studio): towel rails in the room store, saved with the room`.

### Task 7: The panel button and the rail's points in the lists

**Files:**
- Modify: `frontend/src/components/studio/design-panel/SantexnikaSection.tsx`, locales (`studio.santexnika.rail_add`, `rail`, `rail_none`, `rail_own`)
- Test: `frontend/src/components/studio/design-panel/SantexnikaSection.rail.test.tsx`

**Interfaces:**
- Consumes: Task 6 actions; `railPoints` (Task 3).

- [ ] **Step 1: Failing tests:** in a bathroom "Sochiq quritgich qo'shish" adds a rail and the list shows it with its wall and a delete button; delete removes it; its two points appear in the points list marked as the rail's and with no remove button; the summary counts them (water points + 2); in a room with no walls the button shows the "no room" message and adds nothing; in a kitchen the button is not shown.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement:** points shown = `[...plumbing, ...railPoints(towelRails, geometry)]`, for the list and for `plumbingSummary`.
- [ ] **Step 4: Run** `src/components/studio/design-panel`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(studio): add and remove a towel rail from the plumbing panel`.

### Task 8: The ladder in 3D, its drag and its pipe runs

**Files:**
- Create: `frontend/src/pages/studio/three-d/TowelRails3D.tsx`, `frontend/src/pages/studio/three-d/__tests__/towelRails3D.test.ts`
- Modify: `frontend/src/pages/studio/three-d/PlumbingPoints3D.tsx` (draw rail points and their runs; rail points do not start a drag), `frontend/src/pages/studio/three-d/ThreeDCanvasScene.tsx` (mount `<TowelRails3D controlsRef hiddenWalls />` beside `PlumbingPoints3D`)

**Interfaces:**
- Produces: `towelRailPose(rail: TowelRail, geometry: RoomGeometry): { x: number; y: number; z: number; rotY: number } | null` (centre of the rail, 30 mm off the wall, `y = (heightMm + 400) / 1000`; `null` for a wall the room does not have); `ladderBars(): Array<{ x: number; y: number; length: number; vertical: boolean }>` (two uprights at ±0.25 m, six rungs evenly between y −0.35 and +0.35, metres, rail-local); `dragToPositionMm(geometry, wallId, worldX, worldZ): number` (the pointer's place projected on the wall's walk).
- Drag: pointer down → `beginTowelRailDrag()`, controls off; move → `moveTowelRail(id, dragToPositionMm(...))`; up → `endTowelRailDrag()`, controls on. Same pattern as `PlumbingPoints3D`.

- [ ] **Step 1: Failing tests** (pure functions): the pose on wall A of an A–D room at a known position; `null` for an unknown wall; `ladderBars()` gives 2 vertical and 6 horizontal bars inside 0.5 × 0.8 m; `dragToPositionMm` returns the walk position for a point in front of the wall, on an A–D room's wall C (where the walk runs against the wall's own direction) and on a polygon wall.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** the functions and the component (cylinders, `meshStandardMaterial` metalness 0.9, roughness 0.25, colour `#C9CDD2`); rails on a hidden wall are not drawn.
- [ ] **Step 4: Run** `src/pages/studio/three-d`, `npx tsc -b`, then the full frontend suite. Expected: PASS, clean.
- [ ] **Step 5: Commit** `feat(studio): towel rail drawn in 3D, dragged along its wall`.

### Task 9: Mobile checklist

**Files:**
- Create: `docs/qa/2026-11-10-sochiq-quritgich-ventilyator-mobil-tekshiruv.md` (Uzbek, the shape of `docs/qa/2026-11-08-santexnika-mobil-tekshiruv.md`)

- [ ] **Step 1: Write it:** sections for the fan (estimate lines, the switch, ru/en, PDF), the rail in the panel (add, list, delete, no-room message), the rail in 3D (the ladder's look first, drag with a finger, door in the way, pipe runs, undo, save and reopen), the rail in the estimate (lines, formula, ru/en, PDF), old rooms. Mark with ⭐ what only a real phone can confirm: the ladder's look and the drag.
- [ ] **Step 2: Commit** `docs(qa): towel rail and fan checklist for the mobile app`. Push, open PR 3 against `feat/towel-rail-estimate`.

---

## After the last task

Final whole-branch review by a fresh reviewer (plan, spec, the Review Focus list, the ledger's rulings). Then fold PR 3 into PR 2 into PR 1, CI on PR 1, and merge to master only when the owner says.
