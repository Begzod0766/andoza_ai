# Tile Work and Waterproofing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A room with tile gets the tile, adhesive, grout and laying work in its estimate; a wall can be tiled to a chosen height with paint above; a bathroom's estimate gets waterproofing.

**Architecture:** The estimate engine (`backend/app/services/smeta.py`, sync and pure) gains tile-band areas, tile-work lines and waterproofing lines, priced from shop products tagged with new `smeta_key` values or from `tile_norms.json`. The wall tile covering gains two optional fields (`tileHeightMm`, `aboveColor`); the 3D wall splits its segments at that height. Waterproofing areas come from a new pure module that reuses the plumbing code's wall frames.

**Tech Stack:** FastAPI + SQLAlchemy (pytest); React + zustand + react-three-fiber (vitest); i18next uz/ru/en.

**Spec:** `docs/superpowers/specs/2026-11-10-plitka-gidroizolyatsiya-design.md`

## Global Constraints

- Three pull requests: PR1 = Tasks 1–4, PR2 = Tasks 5–7 (stacked on PR1), PR3 = Tasks 8–9 (stacked on PR2). Merge only when the owner says; a merge to master deploys to production.
- TDD: every test is written first and seen to fail.
- Saved room geometry is in metres with element `position` a 0–1 centre fraction; the studio store is in mm. `room.ceiling_h` is metres.
- Every new estimate label, unit, formula word and warning is translated (uz/ru/en) on the page (`frontend/src/lib/smetaLineText.ts`) and in the PDF (`backend/app/services/smeta_text.py`). `backend/app/services/smeta_locale.json` is a generated copy: refresh it with `python -m app.services.smeta_text ../frontend/src/i18n/locales` from `backend/`.
- Every `category="…"` the engine emits needs a group in `backend/app/services/smeta_groups.py` (`test_smeta_groups` checks) and in `frontend/src/lib/smetaGroups.ts`.
- Money is integer so'm; quantities to two decimals with `_round2` (JS-style, in `smeta.py`).
- Rooms saved before this work must price exactly as today unless they carry tile.
- Commands: backend `cd backend && /Users/mac/.cache/andoza-bvenv/bin/python -m pytest <path> -q -p no:cacheprovider` (full suite adds `--ignore=tests/test_room_scan_router.py`); frontend `export PATH=$HOME/.local/node/bin:$PATH; cd frontend && npx vitest run <path>`; typecheck `npx tsc -b`, then delete `vite.config.js vite.config.d.ts tsconfig.tsbuildinfo tsconfig.node.tsbuildinfo` in a separate command.
- Commit trailer: `Co-Authored-By: Claude <noreply@anthropic.com>`. Stage named files only; never `docs/partners/*`.

## Review Focus

1. **A covering set only under `ALL`** (no per-wall key): every wall is tiled; the tile area must count them all. Test in Task 2.
2. **An opening that reaches past the tile band**, or sits wholly above it: only the part inside the band is subtracted, never more than the band. Test in Task 2 and Task 5.
3. **A scanned polygon room** (walls `"0".."n"`, with `vertices`): tile areas and wet zones must work on those walls. Test in Task 2 and Task 8.
4. **A fixture turned at an angle, or standing clear of every wall**: it gives no wet zone and nothing crashes. Test in Task 8.
5. **A finished floor (`floor_state == "tayyor"`) or ceiling lowered below the tile height**: no floor-tile lines for a finished floor; a band above the ceiling prices to the ceiling. Test in Task 3 and Task 5.

---

## PR 1: tile work in the estimate

### Task 1: Norms and product keys

**Files:**
- Create: `backend/app/data/tile_norms.json`, `backend/app/services/tile_work.py`
- Modify: `backend/app/services/smeta_keys.py`
- Test: `backend/tests/test_tile_work.py`, `backend/tests/test_smeta_keys.py`

**Interfaces:**
- Produces: `load_tile_norms() -> dict` (in `tile_work.py`, `lru_cache`d), with exactly these keys and starting values:
  - `adhesive_kg_m2` 5, `adhesive_bag_kg` 25, `adhesive_bag_uzs` 45000
  - `grout_kg_m2` 0.4, `grout_pack_kg` 2, `grout_pack_uzs` 35000
  - `wall_tile_m2_uzs` 120000
  - `work_floor_m2_uzs` 80000, `work_wall_m2_uzs` 100000
  - `mastic_kg_m2` 1.5, `mastic_kg_uzs` 28000, `tape_m_uzs` 7000, `work_waterproof_m2_uzs` 25000
- Produces: `KEY_PACK_UNIT` gains `"plitka_yelimi": "kg"`, `"zatirka": "kg"`, `"gidro_mastika": "kg"`, `"gidro_lenta": "m"`. `pick_cheapest` (already keyed by `smeta_key`) then hands them to the engine as `catalog["plitka_yelimi"]` and so on.

- [ ] **Step 1: Write the failing tests.** `test_tile_work.py::test_norms_have_every_key` asserts the key set above and that every value is > 0. In `test_smeta_keys.py`, a product with `smeta_key="plitka_yelimi"`, `unit="qop"`, `pack_qty=25`, `pack_unit="kg"` has no problem; the same key with no pack is a problem; `"gidro_lenta"` sold by the metre (`unit="m"`) is accepted the way `plintus` is.
- [ ] **Step 2: Run them; expect failures** (module and keys missing).
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them; expect a pass.**
- [ ] **Step 5: Commit.** `feat(smeta): tile norms and product keys for adhesive, grout and waterproofing`

### Task 2: Wall tile priced as tile

**Files:**
- Modify: `backend/app/services/smeta.py`, `backend/app/services/smeta_groups.py`
- Test: `backend/tests/test_smeta_wall_tile.py`

**Interfaces:**
- Produces, in `smeta.py`:
  - `_is_tile(covering: object) -> bool`: a dict with `kind == "texture"` and `finish == "tile"`.
  - `_tile_band_m(covering: dict, ceiling_h_m: float) -> float`: returns `ceiling_h_m` in this task (Task 5 makes it read `tileHeightMm`).
  - `_band_opening_m2(element: dict, band_m: float) -> float`: width × the part of the opening between the floor and `band_m`. An opening spans `sill_height` to `sill_height + height` (metres, `sill_height` absent = 0); result is never negative.
  - `_tile_wall_areas(room) -> list[tuple[str, float]]`: `(wall_id, net tile m²)` for each wall whose covering (own key, else `ALL`) is tile: `length × band − Σ _band_opening_m2`, floored at 0. Empty when the room has no walls.
  - `_wall_tile_line(area_m2: float, wall_ids: list[str], catalog: dict) -> ComputedLine`: label `"Devor plitkasi: <name>"` from `catalog["finish:plitka"]` when present (price per m² via `_price_per(material, "m2")`), else `"Devor plitkasi"` at `wall_tile_m2_uzs`; qty `_round2(area × TILE_WASTE)`, unit `"m²"`, `category="plitka_devor"`, `is_approximate=True`, warning `FINISH_STAND_IN_NOTE` (shop tile) or a new `WALL_TILE_NORM_NOTE = "Narx taxminiy — do'konda plitka topilmadi, o'rtacha narx olindi."`; formula `"{area:.2f} m² × 1.10 (chiqindi) = {qty:.2f} m² (devor A, B)"`.
- `compute_estimate`: a tile covering no longer produces a `_texture_line` or a shop-wallpaper line (`_texture_wall_areas` skips coverings for which `_is_tile` is true); one `_wall_tile_line` is added when the total tile area is > 0. Wall prep (`needs_wall_prep`) is unchanged.
- `smeta_groups.py`: `CATEGORY_TO_GROUP["plitka_devor"] = "pardoz"`.

- [ ] **Step 1: Write the failing tests** (rooms as `SimpleNamespace(state=…, geometry=…, ceiling_h=2.7, …)`, the pattern of `test_smeta_plumbing.py`; geometry 2.5 × 2.0 m, walls A–D):
  - Covering under `ALL` only: `_tile_wall_areas` returns four walls, areas `2.5×2.7`, `2.0×2.7`, … (Review Focus 1).
  - A 0.7 × 2.05 m door on D: D's area is `2.0×2.7 − 0.7×2.05`.
  - `_band_opening_m2`: a window `width 1.2, height 1.4, sill_height 0.9` with `band_m=1.5` gives `1.2×0.6`; with `band_m=0.8` gives 0; a door with `band_m=1.5` gives `0.7×1.5` (Review Focus 2).
  - A polygon room (walls `"0".."5"`, with `vertices`) tiled under `ALL` gives six areas (Review Focus 3).
  - `compute_estimate` on a tiled room: one line with category `plitka_devor`, no line with category `texture`, `needs_ai_price` false everywhere.
  - With `catalog["finish:plitka"]` a product at 150 000 per m²: label carries its name, unit price 150 000, approximate. Without it: 120 000 and `WALL_TILE_NORM_NOTE`.
  - A room with a user photo `texture` (no `finish`) still gets its `texture` line.
- [ ] **Step 2: Run them; expect failures.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them, then `tests/test_smeta_groups.py` and the smeta suites; expect a pass.**
- [ ] **Step 5: Commit.** `feat(smeta): wall tile is priced by the square metre, not as a photo print`

### Task 3: Adhesive, grout and laying work

**Files:**
- Modify: `backend/app/services/smeta.py`, `backend/app/services/smeta_groups.py`
- Test: `backend/tests/test_smeta_tile_work.py`

**Interfaces:**
- Consumes: Task 1 norms, Task 2 `_tile_wall_areas`.
- Produces, in `smeta.py`:
  - `_floor_tile_area_m2(room, floor_mat, floor_already_done: bool) -> float`: `_floor_covering_area_m2(room)` when the floor is tile and not already done, else 0. The floor is tile when `floor_mat.category == "plitka"`, or when no floor material is picked and the studio's `floorConfigured is True` with `floorType == "tile"`.
  - `_tile_work_lines(floor_m2: float, wall_m2: float, catalog: dict) -> list[ComputedLine]`, all `category="plitka_ish"`, none when both areas are 0:
    - `"Plitka yelimi"`: `kg = (floor+wall) × adhesive_kg_m2`; from `catalog["plitka_yelimi"]` when `_bag_from_shop` reads it (label `"Plitka yelimi: <name>"`, its bag size and price, exact); else norm bag, approximate with `TILE_NORM_NOTE = "Narx taxminiy — do'konda bu mahsulot topilmadi, o'rtacha narx olindi."`. Qty = whole bags, `math.ceil`; unit `"qop"`; formula `"{area:.2f} m² × 5 kg/m² = {kg:.1f} kg → {bags} qop ({bag_kg:g} kg)"`.
    - `"Zatirka"`: same shape with `grout_kg_m2`, `grout_pack_kg`, `catalog["zatirka"]`, unit `"dona"`.
    - `"Ish: pol plitkasini terish"`: qty `_round2(floor_m2)`, unit `"m²"`, `work_floor_m2_uzs`; only when `floor_m2 > 0`.
    - `"Ish: devor plitkasini terish"`: qty `_round2(wall_m2)`, `work_wall_m2_uzs`; only when `wall_m2 > 0`.
- `compute_estimate` adds them after the floor section. `smeta_groups.py`: new group `"plitka_ish"` after `"pol"` in `GROUP_ORDER`, label `"Plitka ishlari"`, colour `"#F97316"`, `CATEGORY_TO_GROUP["plitka_ish"] = "plitka_ish"`.

- [ ] **Step 1: Write the failing tests:**
  - Floor 5.0 m² tile + walls 20 m² tile, no shop products: adhesive `125 kg → 5` bags × 45 000, approximate; grout `10 kg → 5` packs × 35 000; floor work 5.0 × 80 000; wall work 20 × 100 000.
  - 5.2 m² floor only: adhesive `26 kg → 2` bags (rounds up); no wall-work line.
  - `catalog["plitka_yelimi"]` = a 25 kg bag at 52 000 from shop "Stroy Master": label names it, price 52 000, store name set, not approximate.
  - `floor_state == "tayyor"` with a tile floor: no floor work, and floor area is left out of adhesive and grout (Review Focus 5).
  - A room with laminate floor and painted walls: no `plitka_ish` line at all.
  - `group_key_for("plitka_ish") == "plitka_ish"`, and it sorts right after `"pol"`.
- [ ] **Step 2: Run them; expect failures.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them, then the full backend suite; expect a pass.**
- [ ] **Step 5: Commit.** `feat(smeta): tile adhesive, grout and laying work`

### Task 4: The lines on the page and in the PDF

**Files:**
- Modify: `frontend/src/lib/smetaGroups.ts`, `frontend/src/components/smeta/CategorySection.tsx`, `frontend/src/lib/smetaLineText.ts`, `frontend/src/i18n/locales/{uz,ru,en}.json`, `backend/app/services/smeta_text.py`, `backend/app/services/smeta_locale.json` (regenerated)
- Test: `frontend/src/lib/__tests__/smetaGroups.test.ts`, `frontend/src/lib/__tests__/smetaLineText.test.ts`, `backend/tests/test_smeta_tile_work.py`

**Interfaces:**
- Frontend group `plitka_ish`: in `GroupKey`, in `GROUP_ORDER` after `"pol"`, colour `"#F97316"`, icon `LayoutGrid` (lucide); `CATEGORY_TO_GROUP.plitka_devor = "pardoz"`, `.plitka_ish = "plitka_ish"`.
- Locale keys under `smeta`: `toifa.plitka_ish` ("Plitka ishlari" / "Плиточные работы" / "Tile work"); `line.wall_tile` ("Devor plitkasi" / "Настенная плитка" / "Wall tile"), `line.tile_adhesive` ("Plitka yelimi" / "Плиточный клей" / "Tile adhesive"), `line.grout` ("Zatirka" / "Затирка" / "Grout"), `line.work_floor_tile` ("Ish: pol plitkasini terish" / "Работа: укладка напольной плитки" / "Work: laying floor tile"), `line.work_wall_tile` ("Ish: devor plitkasini terish" / "Работа: укладка настенной плитки" / "Work: laying wall tile"); `warning.wall_tile_norm`, `warning.tile_norm` (the two notes of Tasks 2 and 3).
- `LABEL_HEADS` / `_LABEL_HEADS` gain `"Devor plitkasi"`, `"Plitka yelimi"`, `"Zatirka"` (a shop product follows the colon); `WHOLE_LABELS` / `_WHOLE_LABELS` gain all five bare labels. `WARNING_KEYS` gains the two warnings. The formula word `kg/m²` already translates; `qop` and `dona` already count.

- [ ] **Step 1: Write the failing tests.** Frontend: a `plitka_ish` line groups under `plitka_ish`, right after `pol`; a `plitka_devor` line under `pardoz`; each label above in `ru` and `en`, with and without a product name; both warnings in `en`; `localizeFormula("125.0 kg → 5 qop (25 kg)", en)` reads `"125.0 kg → 5 bags (25 kg)"`. Backend: the same labels and warnings through `localize_label` / `localize_warning` in `ru` and `en`.
- [ ] **Step 2: Run them; expect failures.**
- [ ] **Step 3: Implement; regenerate `smeta_locale.json`.**
- [ ] **Step 4: Run them, both full suites and `tsc -b`; expect a pass.**
- [ ] **Step 5: Commit.** `feat(smeta): the Plitka ishlari group and its text in uz, ru and en`. Open PR 1.

---

## PR 2: wall tile height

### Task 5: The height in the data and the estimate

**Files:**
- Modify: `frontend/src/store/types.ts`, `backend/app/services/smeta.py`
- Test: `backend/tests/test_smeta_wall_tile.py`

**Interfaces:**
- `WallCovering`'s `texture` variant gains `tileHeightMm?: number` and `aboveColor?: string` (doc comment: only read when `finish === 'tile'`; absent height = to the ceiling).
- `_tile_band_m(covering, ceiling_h_m)`: `min(ceiling_h_m, max(0.3, tileHeightMm / 1000))` when `tileHeightMm` is a positive number, else `ceiling_h_m`.
- Produces `_tile_above_areas(room) -> list[tuple[str, float]]`: `(wall_id, m²)` of each tiled wall above its band: `length × (ceiling − band)` less the part of each opening above the band; walls whose band reaches the ceiling are left out.
- `_painted_wall_areas`: the areas from `_tile_above_areas` are added to the group of that wall's `surfaces` paint material when it has one, else to the `None` group, with the wall id. In `compute_estimate`, `has_any_paint` is also true when `_tile_above_areas(room)` is non-empty.

- [ ] **Step 1: Write the failing tests:**
  - `tileHeightMm: 1500` on wall A (2.5 m, ceiling 2.7): tile area `2.5×1.5`; above area `2.5×1.2`.
  - A door 0.7 × 2.05 on that wall: tile area less `0.7×1.5`, above area less `0.7×0.55`. A window with sill 0.9, height 1.4: `0.6` of it in the band, `0.8` above (Review Focus 2).
  - `tileHeightMm: 3500` with ceiling 2.7: reads as to the ceiling, no above area (Review Focus 5). `tileHeightMm: 100`: band 0.3 m.
  - A covering with no `tileHeightMm`: same areas as Task 2's tests (old rooms).
  - `compute_estimate` with the 1.5 m band and no paint anywhere else: a paint line exists whose area is the above area.
- [ ] **Step 2: Run them; expect failures.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them and the backend suite; expect a pass.**
- [ ] **Step 5: Commit.** `feat(smeta): wall tile to a chosen height, paint above it`

### Task 6: Two bands in 3D

**Files:**
- Create: `frontend/src/lib/tileBand.ts`
- Modify: `frontend/src/pages/studio/three-d/WallComponents.tsx`
- Test: `frontend/src/lib/__tests__/tileBand.test.ts`

**Interfaces:**
- Produces, in `tileBand.ts`:
  - `tileBandM(covering: WallCovering, wallHeightM: number): number | null`: the band height in metres when the covering is tile with a `tileHeightMm` below the wall height (floored at 0.3), else `null` (one band, as today).
  - `splitAtHeight<T extends { py: number; ph: number }>(segs: T[], hM: number): { below: T[]; above: T[] }`: each segment (centre `py`, height `ph`, metres from the floor) goes below, above, or is cut in two at `hM` with `py`/`ph` recomputed. A cut piece thinner than 1 mm is dropped.
- `WallComponents.tsx`: where a wall maps its `segments` to `<WallSegment>`, when `tileBandM` is not null the list is split; `below` renders with the tile covering, `above` with `{ kind: 'paint', color: covering.aboveColor ?? '#FFFFFF' }`. A cut segment's texture fields (`vRepeat`, `startYm`) are recomputed the way `makeCoverSeg` computes them, through one helper used by both. The drag patch segment is split the same way.

- [ ] **Step 1: Write the failing tests** for `tileBandM` (no field, field above the wall, 100 mm → 0.3, paint covering → null) and `splitAtHeight` (wholly below, wholly above, straddling: two pieces whose heights sum to the original and whose centres are right; a sliver under 1 mm dropped).
- [ ] **Step 2: Run them; expect failures.**
- [ ] **Step 3: Implement the lib, then the wall change.**
- [ ] **Step 4: Run them, the studio suites and `tsc -b`; expect a pass. Verify in the browser preview: a wall tiled to 1.5 m shows tile below and paint above, with a door and a window cut through both.**
- [ ] **Step 5: Commit.** `feat(studio): a wall tiled to a height is drawn in two bands`

### Task 7: Choosing the height

**Files:**
- Create: `frontend/src/components/studio/design-panel/TileHeightControls.tsx` and its test
- Modify: `frontend/src/components/studio/design-panel/WallSection.tsx`, `frontend/src/i18n/locales/{uz,ru,en}.json`

**Interfaces:**
- Consumes: `tileBandM` (Task 6); the store's `setWallCovering(wallKey, covering)`; the paint palette `WallSection` already renders.
- Produces `<TileHeightControls wallKey covering ceilingMm />`, rendered by `WallSection` only when the target wall's covering is tile:
  - chips `studio.tile_height.full` ("Shiftgacha" / "До потолка" / "To the ceiling"), "1.5 m", "1.8 m", "2.1 m" (a chip at or above the ceiling is not shown), and a number field labelled `studio.tile_height.custom` ("Balandligi, sm" / "Высота, см" / "Height, cm");
  - "To the ceiling" removes `tileHeightMm`; a height writes it in mm (under 300 → 300);
  - a row `studio.tile_height.above` ("Yuqorisi" / "Выше плитки" / "Above the tile") of paint swatches writing `aboveColor`, shown only while `tileBandM` is not null.
- Section title `studio.tile_height.title` ("Plitka balandligi" / "Высота плитки" / "Tile height").

- [ ] **Step 1: Write the failing tests:** not rendered for a painted wall; "1.5 m" writes `tileHeightMm: 1500` and keeps the tile's other fields; "To the ceiling" removes the field; the custom field with `20` writes 300; the "Above" row appears only below the ceiling and writes `aboveColor`; with a 2.0 m ceiling the "2.1 m" chip is absent; one undo takes a height change back.
- [ ] **Step 2: Run them; expect failures.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them, the i18n parity test, the full suite and `tsc -b`; expect a pass.**
- [ ] **Step 5: Commit.** `feat(studio): choose how high the wall tile goes and the paint above it`. Open PR 2.

---

## PR 3: waterproofing

### Task 8: The areas

**Files:**
- Create: `backend/app/services/waterproofing.py`
- Test: `backend/tests/test_waterproofing.py`

**Interfaces:**
- Consumes: `app.services.plumbing._room_walls(geometry)` (walls with `midX, midZ, dirX, dirZ, nx, nz, length`, metres, room-centred).
- Produces `waterproof_areas(geometry: dict, fixtures: list[dict], floor_m2: float, door_widths_m: float) -> dict` with keys `floor`, `base`, `wet`, `total` (m², each `_round2`-style to two decimals) and `tape_m`:
  - `fixtures`: `{"x", "y"` (mm, room-centred), `"rotation"` (rad), `"w", "d"` (metres)}` for each placed bathtub or shower.
  - `base = (perimeter − door_widths_m) × 0.2`, perimeter from the walls.
  - Wet zone: for each fixture and each wall, the fixture's four corners are projected on the wall; it **touches** when its nearest edge is within 0.15 m of the wall face (distance along the inward normal) and its span along the wall overlaps the wall. The strip is that span widened by 0.3 m each side, clipped to `[0, length]`. Strips on one wall are merged (a union of intervals). `wet = Σ merged length × (1.8 − 0.2)`: the lowest 0.2 m is already in `base`.
  - `tape_m = (perimeter − door_widths_m) + 1.8 × (number of wall-to-wall corners both of whose walls carry a strip reaching that corner)`.
  - No walls: `base`, `wet` and `tape_m` are 0; `total = floor`.

- [ ] **Step 1: Write the failing tests** (2.5 × 2.0 m room, walls A–D, a 0.7 m door):
  - No fixtures: `floor 5.0`, `base (9.0 − 0.7) × 0.2 = 1.66`, `wet 0`, `tape_m 8.3`.
  - A 1.7 × 0.7 bathtub with its back on wall A, centred, ends clear of B and D: one strip on A, `(1.7 + 0.6) × 1.6 = 3.68`.
  - The bathtub pushed into the A–B corner: strips on A (clipped at the corner) and on B (`0.7 + 0.3` long); `tape_m` gains 1.8.
  - A 1.0 × 1.0 shower in a corner: two strips of `1.3 × 1.6`.
  - Two fixtures side by side on one wall whose strips overlap: the overlap is counted once.
  - A fixture in the middle of the room, and one turned 45° near a wall with only a corner within 0.15 m: the first gives no strip; the second gives a strip no longer than its projected span plus 0.6 (Review Focus 4).
  - A polygon room (`"0".."5"`, `vertices`): a shower in one of its corners gives two strips (Review Focus 3).
  - `{"walls": []}`: `total == floor`, nothing raises.
- [ ] **Step 2: Run them; expect failures.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them; expect a pass.**
- [ ] **Step 5: Commit.** `feat(smeta): waterproofing areas for a bathroom`

### Task 9: The lines, their text, and the checklist

**Files:**
- Modify: `backend/app/services/smeta.py`, `backend/app/services/smeta_text.py`, `backend/app/services/smeta_locale.json` (regenerated), `frontend/src/lib/smetaLineText.ts`, `frontend/src/i18n/locales/{uz,ru,en}.json`
- Create: `docs/qa/2026-11-10-plitka-gidro-mobil-tekshiruv.md`
- Test: `backend/tests/test_smeta_waterproofing.py`, `frontend/src/lib/__tests__/smetaLineText.test.ts`

**Interfaces:**
- Consumes: Task 8 `waterproof_areas`; Task 1 norms; `_fixture_role`, `_plumbing_geometry`, `_door_widths_m`, `_floor_covering_area_m2` (all in `smeta.py`); `guess_room_type`.
- Produces `_waterproofing_lines(room, catalog) -> list[ComputedLine]`, all `category="plitka_ish"`, empty unless the room is a bathroom (`room.room_type == "hammom"`, or no type and `guess_room_type(room.name) == "hammom"`):
  - `"Gidroizolyatsiya mastikasi"`: `kg = total × mastic_kg_m2`; from `catalog["gidro_mastika"]` when it is sold by the kg or a pack of known kg (whole packs, `math.ceil`), else per kg at `mastic_kg_uzs`, approximate with `TILE_NORM_NOTE`. Formula `"Pol {floor} m² + devor tagi {base} m² + ho'l zona {wet} m² = {total} m² × 1.5 kg/m² = {kg} kg"`.
  - `"Gidroizolyatsiya lentasi"`: `math.ceil(tape_m)` metres; `catalog["gidro_lenta"]` via `_price_per(material, "m")`, else `tape_m_uzs`, approximate.
  - `"Ish: gidroizolyatsiya"`: `total` m² × `work_waterproof_m2_uzs`.
  - The fixtures passed to `waterproof_areas` are the placed pieces whose `_fixture_role` is `bathtub` or `shower`, sized from the shop row's `footprint_w` / `footprint_d` (cm; 60 when absent) times `scaleOverride`.
- `compute_estimate` adds them after the tile-work lines.
- Locale: `smeta.line.wp_mastic` ("Gidroizolyatsiya mastikasi" / "Гидроизоляционная мастика" / "Waterproofing mastic"), `line.wp_tape` ("Gidroizolyatsiya lentasi" / "Гидроизоляционная лента" / "Waterproofing tape"), `line.work_wp` ("Ish: gidroizolyatsiya" / "Работа: гидроизоляция" / "Work: waterproofing"); formula phrases `formula.wp_floor` ("Pol" / "Пол" / "Floor"), `formula.wp_base` ("devor tagi" / "низ стен" / "foot of the walls"), `formula.wp_wet` ("ho'l zona" / "мокрая зона" / "wet zone"), mirrored in `smetaLineText.ts` and `smeta_text.py`.
- The checklist covers: the tile lines in a tiled room, the height control and the two bands on a phone, the bathroom's waterproofing lines, and the PDF in `en` and `ru`.

- [ ] **Step 1: Write the failing tests:**
  - A bathroom with a bathtub on wall A and a 5.0 m² floor: mastic kg = `total × 1.5`, the formula carries the three areas; tape = `math.ceil(tape_m)`; work = `total × 25 000`; all three under `plitka_ish`.
  - The same room typed `mehmonxona`: no waterproofing line. Type `None` and name "Hammom": lines present. Type `None` and name "Zal": none.
  - A bathroom with no fixtures: mastic for floor and foot of the walls only.
  - A bathroom with no tile anywhere: waterproofing lines present, no adhesive or grout.
  - `catalog["gidro_mastika"]` a 5 kg bucket at 130 000: whole buckets, shop named, not approximate.
  - Labels and the formula in `ru` and `en`, backend and frontend.
- [ ] **Step 2: Run them; expect failures.**
- [ ] **Step 3: Implement; regenerate `smeta_locale.json`; write the checklist.**
- [ ] **Step 4: Run them, both full suites and `tsc -b`; expect a pass.**
- [ ] **Step 5: Commit.** `feat(smeta): waterproofing mastic, tape and work in a bathroom`. Open PR 3.

After the owner merges: check on production that a tiled bathroom's estimate has the wall tile, the "Plitka ishlari" group with adhesive, grout, laying work and waterproofing, in `en` and `ru`.
