# Pipe Scheme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A room's pipes form one scheme (a trunk per pipe kind along the walls, a vertical branch to each point); the estimate's pipe lengths and fittings and the studio's pipe lines all come from it.

**Architecture:** One pure rule, `buildScheme`, written twice (TypeScript and Python) over the same normalised input and pinned by a shared fixture file. Each side has a small adapter from its own room geometry to that input. The estimate and the studio only read the scheme; nothing new is saved.

**Tech Stack:** FastAPI (`backend/app`), pytest; React + zustand + react-three-fiber (`frontend/src`), vitest; i18next uz/ru/en.

**Spec:** `docs/superpowers/specs/2026-11-11-quvur-sxemasi-design.md`

## Global Constraints

- Water trunk height 200 mm; drain trunk height 0. Reserve × 1.15 on pipe length only.
- Water is in series. No manifold.
- The scheme is never saved.
- All lengths in the scheme are integer mm (JS `Math.round`; backend `_js_round`), never negative.
- Comparisons of positions and gaps use a tolerance of `1e-6` mm; ties keep the first in loop order.
- Norms (UZS) in `backend/app/data/plumbing_norms.json` under `fitting_uzs`: `tee_20` 3000, `elbow_20` 2500, `outlet_20` 12000, `valve_20` 35000, `tee_50` 9000, `elbow_50` 6000, `tee_110_50` 22000, `elbow_110` 18000. `fitting_set_uzs` is removed.
- Labels: `PPR troynik Ø20`, `PPR burchak Ø20`, `Suv rozetkasi Ø20`, `Sharli kran Ø20`, `Kanalizatsiya troynigi Ø50`, `Kanalizatsiya burchagi Ø50`, `Kanalizatsiya troynigi Ø110/50`, `Kanalizatsiya burchagi Ø110`. Category `santexnika`.
- Every new label and formula word: uz/ru/en in the locales, `smetaLineText.ts` and `smeta_text.py`; regenerate with `cd backend && python -m app.services.smeta_text ../frontend/src/i18n/locales`.
- TDD: each test written first and seen to fail. Stage named files only; never `docs/partners/*`.
- Commands. Backend: `cd backend && /Users/mac/.cache/andoza-bvenv/bin/python -m pytest <path> -q -p no:cacheprovider` (full suite adds `--ignore=tests/test_room_scan_router.py`). Frontend: `export PATH=~/.local/node/bin:$PATH; cd frontend && npx vitest run <path>`; `npx tsc -b`, then delete `vite.config.js vite.config.d.ts tsconfig.tsbuildinfo tsconfig.node.tsbuildinfo`.
- Commit trailer: `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`.

## The rule (both sides implement exactly this)

**Normalised input**

```
{ wallsMm: number[],            // each wall's length, in walk order; the loop's perimeter P is their sum
  doorsMm: number[],            // each door's middle, as a loop position in [0, P)
  riserMm: number,              // loop position
  points: [{ id, kind: "drain"|"cold"|"hot", diameterMm: 20|50|110, sMm, heightMm }] }
```

A loop position is the distance walked from the start of the first wall. The adapter clamps a point into its wall and reads a negative height as 0.

**Trunks.** Three node sets, each with the riser: cold points, hot points, drain points (Ø50 and Ø110 together).

1. A set with no points gives nothing.
2. Sort the distinct positions (riser and points). The gaps are the stretches between neighbours, the last wrapping to the first; one distinct position gives a single gap of `P`.
3. A gap holds a door when a door's middle lies strictly inside it. If any gap holds a door, the cut is the largest of those; otherwise the largest gap. **The drain set ignores doors** (owner's ruling after the final review, 2026-11-11): its cut is always the largest gap.
4. The trunk is the loop less the cut: it starts where the cut ends. `t(x)` is the forward distance from that start. `T = P − cut`.
5. `trunkMm = max t − min t` over the nodes, which is `T`.
6. Arms: the left arm holds the points with `t < t(riser)`, the right arm those with `t > t(riser)`. Points at the riser's own place join the right arm if it has points, else the left, else they are an arm of their own.
7. A point's distance on its arm is `|t − t(riser)|`.

**Branches.** Water: `|heightMm − 200|`. Drain: `heightMm`.

**Room corners.** The loop positions where one wall ends and the next begins (`0`, and each running sum of `wallsMm` below `P`). A trunk passes a corner whose `t` is strictly between its `min t` and `max t`.

**Water fittings**, for cold and for hot, then added:

- On each arm, order the points by distance; the farthest takes the end (two at the same farthest place: the first by id takes it). `ends` = number of arms with points; `branches` = points − `ends`.
- `riser` = 1 when both the left and the right arm have points, else 0.
- `tee_20 = branches + riser`; `elbow_20 = corners + ends`; `outlet_20 = points`; `valve_20 = 1`.

**Drain.**

- On each arm, `m110` = the greatest distance of a Ø110 point (0 when the arm has none, and then `has110` is false).
- Ø110 way on the arm: from the riser out to `m110`. `drain_110.trunkMm` = the sum over the arms; `drain_50.trunkMm = trunkMm − that`.
- A Ø110 point's branch is Ø110; a Ø50 point's branch is Ø50.
- On an arm with a Ø110 point: Ø50 points at distance ≤ `m110` each give one `tee_110_50`. Ø50 points beyond `m110` form the Ø50 tail: the farthest takes its end (`elbow_50`), the others a `tee_50` each, and the tail joins the Ø110 way with one more `tee_110_50`.
- On an arm with no Ø110 point: the farthest point takes the end (`elbow_50`), the others a `tee_50` each.
- `elbow_110` = number of Ø110 points + corners on the Ø110 way (distance from the riser < `m110` on that arm). `elbow_50` also counts the corners the trunk passes that are not on the Ø110 way.
- Several toilets on one arm need a Ø110 tee the list does not have: not counted (spec: out of scope by silence; ledger it).

**Output** (the same JSON on both sides)

```
{ pipes:    { water_20: {trunkMm, branchMm}, drain_50: {trunkMm, branchMm}, drain_110: {trunkMm, branchMm} },
  fittings: { tee_20, elbow_20, outlet_20, valve_20, tee_50, elbow_50, tee_110_50, elbow_110 },
  why:      { tee_20: {branches, riser}, elbow_20: {corners, ends}, outlet_20: {points}, valve_20: {lines},
              tee_50: {branches}, elbow_50: {corners, ends}, tee_110_50: {joins}, elbow_110: {toilets, corners} },
  lines:    [{ kind: "cold"|"hot"|"drain", diameterMm, fromMm, toMm, heightMm }],   // loop positions, walked forward; toMm may pass P
  branches: [{ pointId, kind, diameterMm, sMm, fromHeightMm, toHeightMm }] }
```

`water_20` adds cold and hot. `lines` has one entry per trunk stretch of one diameter; the hot trunk's `heightMm` is 250 (drawn 50 mm above the cold one; lengths are not affected). Entries are ordered cold, hot, drain; branches in the order of the input points.

## Review Focus

1. A room with no door at all: the cut is the largest gap, and the trunk still reaches every point.
2. A point exactly at the riser's place, alone: no negative or NaN length, one end elbow, no tee.
3. A polygon room with fractional wall lengths: the two sides round alike (the shared fixture has such a case).
4. A room priced from its saved state geometry (no geometry on the row): door middles are found from mm positions, not read as fractions.
5. A room whose only points are a towel rail's two: a hot trunk, no cold line, `valve_20 = 1`, no drain lines.

Each has a test in Tasks 1 to 3.

---

## PR 1: the scheme (branch `feat/pipe-scheme`)

### Task 1: The rule and the studio adapter

**Files:**
- Create: `frontend/src/lib/pipeScheme.ts`, `frontend/src/lib/__tests__/pipeScheme.test.ts`

**Interfaces:**
- Produces: types `SchemeInput`, `PipeScheme` (the shapes above); `buildScheme(input: SchemeInput): PipeScheme`; `schemeInput(geometry: RoomGeometry, riser: { wallId: string; positionMm: number }, points: readonly PlumbingPoint[]): SchemeInput` (walls from `wallWalk`; door middles from `resolveElementPositions`, turned to walk direction as `lib/towelRail` `freeSpans` does, elements with `type === 'eshik'` only; points on a missing wall dropped, positions clamped, negative heights 0); `pipeScheme(geometry, riser, points): PipeScheme`; `WATER_TRUNK_MM = 200`; `EMPTY_SCHEME`.

- [ ] **Step 1: Failing tests**, with hand-worked numbers, on `buildScheme` directly (a 2500/2000/2500/2000 loop, `P = 9000`, corners at 0, 2500, 4500, 7000):

```ts
// one door (middle at 8000), riser at 7000, cold points at 1000 (h 550) and 3000 (h 1050)
//   nodes 1000, 3000, 7000 → gaps 2000, 4000, 3000(wrap, holds the door) → cut = the door's gap
//   trunk from 1000 to 7000 = 6000; branches 350 + 850 = 1200
//   one arm (both points left of the riser): ends 1, branches 1, riser 0; corners passed: 2500, 4500
expect(s.pipes.water_20).toEqual({ trunkMm: 6000, branchMm: 1200 })
expect(s.fittings).toMatchObject({ tee_20: 1, elbow_20: 3, outlet_20: 2, valve_20: 1 })
expect(s.why.elbow_20).toEqual({ corners: 2, ends: 1 })
```

and one test each for: no door (cut = largest gap); two doors (the largest door gap is the cut, the other door is crossed); riser mid-wall with points both sides (`riser: 1`, two ends); all points one side; a point at trunk height (branch 0); a single point at the riser's place (trunk 0, `ends 1`, `tee_20 0`); cold and hot together (`valve_20 2`, `water_20` sums both); drain with the toilet beside the riser, farthest, in the middle (Ø50 tail: `tee_110_50` counts the join), and no toilet; a Ø50 point on the Ø110 way; two points at one place; no points (`EMPTY_SCHEME`); `lines` and `branches` for the first case. For `schemeInput`: an A–D room and a polygon room give the walk-order lengths; a door's middle on walls A and C (the walk runs against C's own direction); a point on wall "Z" dropped; a position past the wall clamped; height −50 read as 0; a window is not a door.

- [ ] **Step 2: Run** `npx vitest run src/lib/__tests__/pipeScheme.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** `pipeScheme.ts` as "The rule" says.
- [ ] **Step 4: Run.** Expected: PASS. `npx tsc -b` clean.
- [ ] **Step 5: Commit** `feat(plumbing): the pipe scheme rule and its studio adapter`.

### Task 2: The same rule on the backend, pinned by a shared file

**Files:**
- Create: `backend/app/services/pipe_scheme.py`, `backend/tests/test_pipe_scheme.py`, `frontend/src/lib/__tests__/fixtures/pipeScheme.json`
- Modify: `frontend/src/lib/__tests__/pipeScheme.test.ts` (a block that checks the fixture), `backend/app/services/smeta.py` (`_plumbing_geometry`: the state-geometry fallback also turns each element's `position` (mm from the wall's start) and `width` (mm) into the row geometry's form: `position` the 0–1 fraction of the element's middle, `width` in metres)

**Interfaces:**
- Consumes: `_room_walls`, `_wall_walk`, `_js_round` (`app.services.plumbing`).
- Produces: `build_scheme(inp: dict) -> dict`; `scheme_input(geometry: dict | None, riser: tuple[str, float], points: list[dict]) -> dict` (geometry in metres, element `position` the 0–1 fraction of its middle along the wall's own direction, `width` in metres, `type == "eshik"` only); `pipe_scheme(geometry, riser, points) -> dict`; `EMPTY_SCHEME`.

- [ ] **Step 1: Write the fixture and the failing tests.** `pipeScheme.json`: `{_doc, cases: [{name, geometry (studio mm), riser, points, input, expected}]}`. Generate `input` and `expected` with the Task 1 code (a short vitest script run once, not committed) for: the hand-worked cases of Task 1 as rooms; the "Hammom" layout (bathtub on A, toilet on B, sink on C, shower in a corner, a towel rail, one door on D); an A–D room with no door; one with two doors; an L-shaped polygon; a polygon with a slanted wall (fractional lengths); a room with only a towel rail's two points; a point at the riser. Check each generated `expected` against the rule by reading it before committing. Tests: frontend `pipeScheme(...)` and `schemeInput(...)` equal `expected` and `input` for every case; backend the same through `_metres(geometry)` (as `tests/test_plumbing.py` does, here also turning each element's mm `position` and `width` into the fraction and metres). Backend adds: `pipe_scheme(None, ("A", 0), [])` and bad data (`points` holding `None`, a string, a point with no wall) give `EMPTY_SCHEME` or skip the entry without error; the `_plumbing_geometry` fallback test: a room with no row geometry and a door in its state geometry gets the same scheme as the same room with row geometry.
- [ ] **Step 2: Run both.** Expected: frontend PASS on the new block (it generated the file), backend FAIL (module missing).
- [ ] **Step 3: Implement** `pipe_scheme.py` and the fallback change.
- [ ] **Step 4: Run** both files, then `tests/test_smeta_towel_rail.py tests/test_smeta_plumbing.py`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(plumbing): the pipe scheme on the backend, one rule with the studio`. Push, open PR 1 against `master`.

---

## PR 2: the estimate (branch `feat/pipe-scheme-estimate`, on PR 1)

### Task 3: Pipe and fitting lines from the scheme

**Files:**
- Modify: `backend/app/services/smeta.py` (`_plumbing_lines`), `backend/app/data/plumbing_norms.json`, `backend/app/services/smeta_text.py`, `backend/app/services/smeta_locale.json` (generated), `frontend/src/lib/smetaLineText.ts`, `frontend/src/i18n/locales/{uz,ru,en}.json`
- Modify tests: `backend/tests/test_smeta_plumbing.py`, `backend/tests/test_smeta_towel_rail.py`, any estimate fixture that counts plumbing lines
- Create: `backend/tests/test_smeta_pipe_scheme.py`

**Interfaces:**
- Consumes: `pipe_scheme` (Task 2).
- Changes `_plumbing_lines`: the scheme is built once from the points it already gathers and the riser it already resolves. Pipe lines: for `water_20`, `drain_50`, `drain_110` with `trunkMm + branchMm > 0`: metres `= _round2((trunkMm + branchMm) / 1000 * 1.15)`, formula `"Magistral {trunk:.2f} m + tik {branch:.2f} m = {sum:.2f} m × 1.15 = {metres:g} m"`. Fitting lines in the order of the label list, each when its count > 0: `qty = count`, unit `dona`, the norm price, approximate with `PLUMBING_FITTINGS_WARNING`; formulas:
  - `tee_20`: `"{branches} tarmoq + {riser} stoyak = {n} dona"`, or `"{branches} tarmoq"` when `riser` is 0
  - `elbow_20`, `elbow_50`: `"{corners} burchak + {ends} uch = {n} dona"`
  - `outlet_20`: `"{points} nuqta"`; `valve_20`: `"{lines} liniya"`
  - `tee_50`: `"{branches} tarmoq"`; `tee_110_50`: `"{joins} ulanish"`
  - `elbow_110`: `"{toilets} unitaz + {corners} burchak = {n} dona"`
- New counted words for the formula translation (as `nuqta` is today): `tarmoq`, `stoyak`, `burchak`, `uch`, `unitaz`, `liniya`, `ulanish`; and the words `Magistral` and `tik` of the pipe formula.

- [ ] **Step 1: Failing tests** in `test_smeta_pipe_scheme.py`:

```python
def test_pipe_lines_come_from_the_scheme():
    s = pipe_scheme(GEOMETRY, riser_spot(GEOMETRY, None), PLUMBING)
    got = by_label(_plumbing_lines(room(), {}))
    w = s["pipes"]["water_20"]
    assert got["Suv quvuri PPR Ø20"].qty == _round2((w["trunkMm"] + w["branchMm"]) / 1000 * 1.15)
    assert got["Suv quvuri PPR Ø20"].formula.startswith(f"Magistral {w['trunkMm'] / 1000:.2f} m + tik {w['branchMm'] / 1000:.2f} m = ")

def test_the_room_needs_less_pipe_than_a_run_per_point(): ...      # new metres < the old sum of pipe_run_m × 1.15
def test_each_fitting_is_a_line_with_its_count_price_and_working(): ...   # all eight, from s["fittings"] and s["why"]
def test_the_set_per_point_line_is_gone(): ...                     # "Fitinglar" not in labels
def test_a_fitting_with_a_count_of_zero_is_not_listed(): ...       # no toilet → no Ø110 lines
def test_a_room_with_only_a_towel_rail(): ...                      # hot trunk, valve 1, no drain lines
def test_hand_added_and_derived_points_join_the_scheme(): ...
def test_a_room_with_no_plumbing_is_unchanged(): ...               # _plumbing_lines == []
def test_no_line_is_ever_negative(): ...                           # the bad-data rooms of Task 2
def test_labels_and_formulas_read_in_russian_and_english(): ...
#   "PPR troynik Ø20" → "Тройник PPR Ø20" / "PPR tee Ø20"; "PPR burchak Ø20" → "Угол PPR Ø20" / "PPR elbow Ø20"
#   "Suv rozetkasi Ø20" → "Водорозетка Ø20" / "Wall outlet Ø20"; "Sharli kran Ø20" → "Шаровой кран Ø20" / "Ball valve Ø20"
#   "Kanalizatsiya troynigi Ø50" → "Канализационный тройник Ø50" / "Drain tee Ø50"
#   "Kanalizatsiya burchagi Ø50" → "Канализационный отвод Ø50" / "Drain elbow Ø50"
#   "Kanalizatsiya troynigi Ø110/50" → "Канализационный тройник Ø110/50" / "Drain tee Ø110/50"
#   "Kanalizatsiya burchagi Ø110" → "Канализационный отвод Ø110" / "Drain elbow Ø110"
#   formula "Magistral 6.00 m + tik 1.20 m = 7.20 m × 1.15 = 8.28 m" → "Trunk 6.00 m + branches 1.20 m = …" / "Магистраль 6.00 м + отводы 1.20 м = …"
#   formula "5 tarmoq + 1 stoyak = 6 dona" reads in en and ru with plurals
```

- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Update the older tests that pinned run-per-point metres and the fittings set to the scheme's numbers (their intent, "the pipes and fittings are priced", stays).
- [ ] **Step 4: Run** the full backend suite and `npx vitest run src/lib`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(smeta): pipes and fittings priced from the pipe scheme`. Push, open PR 2 against `feat/pipe-scheme`.

---

## PR 3: the studio (branch `feat/pipe-scheme-studio`, on PR 2)

### Task 4: The 3D lines and the panel summary

**Files:**
- Modify: `frontend/src/lib/pipeScheme.ts` (drawing helper), `frontend/src/lib/__tests__/pipeScheme.test.ts`, `frontend/src/pages/studio/three-d/PlumbingPoints3D.tsx`, `frontend/src/components/studio/design-panel/SantexnikaSection.tsx`, `frontend/src/lib/plumbingRuns.ts` (`plumbingSummary` reads the scheme)

**Interfaces:**
- Produces: `schemePolylines(geometry: RoomGeometry, scheme: PipeScheme): Array<{ key: string; kind: 'drain' | 'cold' | 'hot'; diameterMm: number; points: Array<[number, number, number]> }>` (world metres `[x, y, z]`: each trunk line broken at the room corners it passes, 40 mm off the wall, at its height; each branch a vertical two-point line). `plumbingSummary(geometry, points, riser)` keeps its signature and return shape; its metres become `(trunkMm + branchMm) / 1000 × 1.15` from the scheme (`drain` = Ø50 + Ø110).

- [ ] **Step 1: Failing tests:** `schemePolylines` for the first hand-worked case: the cold trunk is one polyline with a vertex at each corner it passes, at `y = 0.2`; a branch is vertical at its point's place from 0.2 to the point's height; the Ø110 line carries `diameterMm: 110`; a trunk that wraps past the loop's start is still one continuous polyline; an empty scheme gives `[]`. `plumbingSummary` metres equal the scheme's for the "Hammom" fixture case and are less than the old run-per-point sum. `SantexnikaSection` shows those metres.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** `PlumbingPoints3D`: with `showPipeRuns`, draw `schemePolylines(...)` (`lineWidth` 2 for Ø20 and Ø50, 4 for Ø110) in place of a `pipeRunPath` per point. `pipeRunM` and `pipeRunPath` stay (the towel rail's placing uses `pipeRunM`).
- [ ] **Step 4: Run** `src/lib src/components/studio src/pages/studio`, `npx tsc -b`, then the full frontend suite. Expected: PASS, clean.
- [ ] **Step 5: Commit** `feat(studio): pipe runs drawn as the scheme, and summed from it`.

### Task 5: Mobile checklist

**Files:**
- Create: `docs/qa/2026-11-11-quvur-sxemasi-mobil-tekshiruv.md` (Uzbek, the shape of `docs/qa/2026-11-10-sochiq-quritgich-ventilyator-mobil-tekshiruv.md`)

- [ ] **Step 1: Write it:** the 3D lines first (one trunk per colour along the walls, not a fan of lines; vertical branches to each point; water above the floor, drain on it; the thicker Ø110; nothing across the door; lines follow a moved fixture), the panel summary against the estimate's metres, the estimate (pipe formulas, the eight fitting lines, no "Fitinglar" set, ru/en, PDF), old rooms. Mark with ⭐ what only a screen can confirm.
- [ ] **Step 2: Commit** `docs(qa): pipe scheme checklist for the mobile app`. Push, open PR 3 against `feat/pipe-scheme-estimate`.

---

## After the last task

Final whole-branch review by a fresh reviewer (plan, spec, the Review Focus list, the ledger's rulings). Before folding: compute the "Hammom" room's plumbing lines on production as it is (read-only) and keep them, to report against the same after the deploy. Then fold PR 3 into PR 2 into PR 1, CI on PR 1, and merge to master only when the owner says.
