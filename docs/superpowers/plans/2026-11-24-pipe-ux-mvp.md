# Pipe UX MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the automatic pipe scheme memorable (it grows) and lightly adjustable (tap a pipe → card with way round, water trunk height, tees/collector, each with its estimate difference in m and so'm).

**Architecture:** The shared rule (`frontend/src/lib/pipeScheme.ts` ⇄ `backend/app/services/pipe_scheme.py`, pinned by `pipeScheme.json`) gains a `route` (avoid spots + water trunk height) read from `designState`. A new `GET /rooms/{room_id}/plumbing-prices` returns the prices the estimate uses; the front mirrors the estimate's pipe money in a pure `pipeCost`, pinned by a new `pipeCost.json` fixture. The 3D gets an invisible hit tube per pipe, a pipe selection store and a `PipeCard`, plus a grow animation driven by a pure path helper.

**Tech Stack:** React 18 + react-three-fiber + drei + zustand (zundo undo) + i18next, vitest; FastAPI + pytest.

**Spec:** `docs/superpowers/specs/2026-11-24-pipe-ux-design.md` (approved 2026-11-24). **Plan approved by the owner 2026-11-24; execution: subagent-driven.** Read it first; this plan does not repeat its reasoning.

## Global Constraints

- Absent `designState.pipeAvoid` / `designState.waterTrunk` ⇒ scheme, drawing and estimate **byte-identical to today**; every existing `pipeScheme.json` case passes unchanged.
- Water trunk heights: `'floor'` = 0 mm, absent = 200 mm, `'high'` = 1000 mm. Hot drawn at trunk + 50 mm; collector lines step `COLLECTOR_STEP_MM` (30) above.
- With `waterTrunk === 'floor'` the water trunks are handed **no doors** (like the drain) and `_chase_lines` chases only the water **branches**.
- Cold and hot share one avoid spot (`water`); the drain has its own (`drain`).
- Stored as `RiserAt` (`{ wallId, positionMm }`), normalised with the existing `place()` on both sides.
- Pipe tap: `DRAG_SLOP_PX` (6 px), < 500 ms, no `multiTouchGuard` multi-touch since press; `claimItemPress()` at pointerdown; no drag, no delete.
- Hit tube radius: 0.05 m (touch), 0.03 m (mouse). Item hits within 0.15 m of the pipe hit win.
- Grow: ~0.7 s per new point, ≤ 1.2 s for the once-per-session whole scheme, 0.5 s regrow after a card pick; none under `prefers-reduced-motion: reduce`, on drag, undo/redo, load, render/thumbnail/panorama.
- Money shown: metres with the 1.15 reserve, 1 decimal; so'm rounded to 1 000; sign shown.
- i18n: every new key in `uz.json`, `ru.json`, `en.json` with the spec's texts (spec § i18n table).
- No render credit used. No merge (master deploys prod). Never stage `docs/partners/*`; stage named files only.
- Commits end `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; PR bodies end `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- Node lives at `~/.local/node/bin` (not on PATH). After `tsc -b`, delete emitted `frontend/vite.config.js`, `vite.config.d.ts`, `*.tsbuildinfo`.

## PR boundaries (4 PRs, in this order)

| PR | Tasks | Branch | Ships | Safe alone? |
|---|---|---|---|---|
| **1. Rule + storage** | 1–4 | `feat/pipe-route-rule` | `route` in both rule copies, fixture cases, estimate reads it, `DesignState` keys | Yes: nothing writes the keys yet |
| **2. Prices + cost** | 5–7 | `feat/plumbing-prices` (from master after PR 1) | Endpoint, `pipeCost`, money fixture, prices in the store | Yes: nothing shows it yet |
| **3. Grow animation** | 8–9 | `feat/pipe-grow` (from master; independent of 1–2, may be opened in parallel with 2) | Pipes grow on new points and once per session | Yes |
| **4. Tap + card** | 10–13 | `feat/pipe-card` (from master after 1–3) | Hit tubes, pipe selection, `PipeCard`, i18n, phone QA doc | Needs 1–3 merged |

Each PR: full `vitest run` for touched areas + `pytest backend/tests -q -k "pipe or smeta or plumbing"` green, typecheck clean, then the owner's phone QA (PR 3 and 4) before the owner says «merge qil».

## File map

| File | Change | Task |
|---|---|---|
| `frontend/src/lib/pipeScheme.ts` | `PipeRoute`, `routeOf`, avoid + height in `trunkOf`/`buildScheme`/`schemeInput`/`pipeScheme`; `pathToPoint`; `pipeCost`, `PlumbingPrices` | 1, 5, 8 |
| `backend/app/services/pipe_scheme.py` | Same rule changes | 2 |
| `frontend/src/lib/__tests__/fixtures/pipeScheme.json` | New cases with `route` | 1, 2 |
| `frontend/src/lib/__tests__/fixtures/pipeCost.json` | **New**: money parity | 5, 6 |
| `frontend/src/store/types.ts` | `DesignState.pipeAvoid`, `waterTrunk` | 3 |
| `frontend/src/lib/plumbingRuns.ts` | `plumbingSummary(…, route?)` | 3 |
| `frontend/src/pages/studio/three-d/PlumbingPoints3D.tsx` | Pass route; `collectorFeed` height; grow; hit tubes | 3, 9, 10 |
| `frontend/src/components/studio/design-panel/SantexnikaSection.tsx` | Pass route to the summary | 3 |
| `backend/app/services/smeta.py` | Read route; `plumbing_prices()`; chase floor rule | 4, 6 |
| `backend/app/routers/estimate.py` | `GET /plumbing-prices` | 6 |
| `frontend/src/lib/api/plumbingPrices.ts` | **New** client | 7 |
| `frontend/src/store/slices/plumbingSlice.ts` | `plumbingPrices` (not saved, not in undo) | 7 |
| `frontend/src/pages/studio/three-d/usePipeGrow.ts` | **New** grow state | 9 |
| `frontend/src/features/studio/pipeSelection.ts` | **New** selection store | 11 |
| `frontend/src/pages/studio/three-d/pipeTap.ts` | **New** tap logic | 10 |
| `frontend/src/pages/studio/three-d/PipeCard.tsx` | **New** card | 12 |
| `frontend/src/lib/pipeOptions.ts` | **New** card options + deltas | 12 |
| `frontend/src/i18n/locales/{uz,ru,en}.json` | `studio.santexnika.pipe_card.*` | 12 |
| `docs/qa/2026-11-2x-quvur-karta-telefon.md` | **New** phone QA checklist | 13 |

## Review Focus

1. **A saved room with neither new key** must price exactly as before — the PR 1 estimate test snapshots an existing fixture room's santexnika lines before/after (Task 4).
2. **Avoid spot on a wall later deleted or shortened** — ignored, not a crash, on both sides (Task 1 test `a spot on a wall the room no longer has is ignored`, Task 2 the same case via the fixture).
3. **Tapping a pipe that runs right over a point disc on a phone** — the disc drag must win (Task 10 test `a press on a disc in front of a pipe is the disc's`).
4. **Prices failed to load / guest** — card still opens, shows metres and «Narx yuklanmadi», never «0 so'm» (Task 12 test `no prices: metres only`).
5. **Card open while the user drags the riser or a point** — the card's deltas recompute from the live scheme; the card closes if its pipe kind disappears (Task 12 test `the card closes when its pipe is gone`).

---

## PR 1 — Rule + storage

### Task 1: Front rule — avoid spot and water trunk height

**Files:**
- Modify: `frontend/src/lib/pipeScheme.ts`
- Test: `frontend/src/lib/__tests__/pipeScheme.test.ts`
- Modify: `frontend/src/lib/__tests__/fixtures/pipeScheme.json` (append cases)

**Interfaces:**
- Produces:
  - `export interface PipeRoute { avoid?: { water?: RiserAt; drain?: RiserAt }; waterTrunk?: 'floor' | 'high' }` (import `RiserAt` from `plumbingRuns` as a type).
  - `export function routeOf(ds: Pick<DesignState, 'pipeAvoid' | 'waterTrunk'>): PipeRoute` — copies only well-formed values (`waterTrunk` exactly `'floor'|'high'`; an avoid entry only with a string `wallId` and finite `positionMm`).
  - `export const WATER_TRUNK_HEIGHTS = { floor: 0, default: 200, high: 1000 } as const`
  - `SchemeInput` gains `avoidMm?: { water?: number; drain?: number }` and `waterTrunkMm?: number`. Each key is set only when present (so old fixture `input`s stay equal).
  - `schemeInput(geometry, riser, points, collector = false, route: PipeRoute = {})`, `pipeScheme(…same…)`.
  - `trunkOf(input, perimeter, points, doorsMm, avoidMm?: number)`.

- [ ] **Step 1: Write failing unit tests** in `pipeScheme.test.ts` under `describe('buildScheme: the route (2026-11-24)')`, using the file's `scheme()` helper (P = 9000, door at 8000, riser 7000):

```ts
it('a drain avoid spot moves the cut to its gap', () => {
  const pts = [drain('d1', 1000, 0), drain('d2', 3000, 0)]
  expect(scheme(pts).pipes.drain_50.trunkMm).toBe(5000)
  const s = scheme(pts, { avoidMm: { drain: 8000 } })
  expect(s.pipes.drain_50.trunkMm).toBe(6000)
  expect(s.lines).toEqual([{ kind: 'drain', diameterMm: 50, fromMm: 1000, toMm: 7000, heightMm: 0 }])
})
it('a water spot away from the only door is ignored', () => {
  const pts = [cold('c1', 1000, 550), cold('c2', 3000, 1050)]
  expect(scheme(pts, { avoidMm: { water: 5000 } })).toEqual(scheme(pts))
})
it('with no door a water spot moves the cut', () => {
  const pts = [cold('c1', 1000, 550), cold('c2', 3000, 1050)]
  expect(scheme(pts, { doorsMm: [], avoidMm: { water: 8000 } }).pipes.water_20.trunkMm).toBe(6000)
})
it('with two doors a spot in the other door\'s gap moves the cut', () => {
  const pts = [cold('c1', 1000, 550), cold('c2', 3000, 1050)]
  // door gaps 3000→7000 (default cut, the larger) and 7000→1000; the spot picks the second
  const s = scheme(pts, { doorsMm: [8000, 5000], avoidMm: { water: 8500 } })
  expect(s.lines[0]).toMatchObject({ fromMm: 1000, toMm: 7000 })
})
it('a spot on a point or on the riser is ignored', () => {
  const pts = [drain('d1', 1000, 0), drain('d2', 3000, 0)]
  expect(scheme(pts, { avoidMm: { drain: 3000 } })).toEqual(scheme(pts))
  expect(scheme(pts, { avoidMm: { drain: 7000 } })).toEqual(scheme(pts))
})
it('collector lines each take the legal side of the water spot', () => {
  const pts = [cold('c1', 1000, 550), cold('c2', 3000, 1050)]
  expect(scheme(pts, { doorsMm: [], collector: true }).pipes.water_20.trunkMm).toBe(7000) // 3000 + 4000
  const s = scheme(pts, { doorsMm: [], collector: true, avoidMm: { water: 8000 } })
  // c1's own line (nodes 1000, 7000): 8000 lies in 7000→1000, now the cut, so it runs 1000→7000 (6000)
  // c2's own line (nodes 3000, 7000): 8000 lies in 7000→3000, already the cut (4000)
  expect(s.pipes.water_20.trunkMm).toBe(10000)
})
it('a floor trunk passes under the door and its branches are the point heights', () => {
  const s = scheme([cold('c1', 1000, 550), cold('c2', 3000, 1050)], { waterTrunkMm: 0 })
  expect(s.pipes.water_20).toEqual({ trunkMm: 5000, branchMm: 1600 })
  expect(s.lines[0].heightMm).toBe(0)
})
it('a high trunk: branches |h − 1000|, hot drawn 50 above', () => {
  const s = scheme([cold('c1', 1000, 550), hot('h1', 3000, 1050)], { waterTrunkMm: 1000 })
  expect(s.pipes.water_20.branchMm).toBe(500)
  expect(s.lines.find((l) => l.kind === 'hot')!.heightMm).toBe(1050)
  expect(s.branches.find((b) => b.pointId === 'h1')!.fromHeightMm).toBe(1050)
})
```

Plus a `schemeInput` test: `routeOf` + `schemeInput(rect(2500, 2000, { D: [DOOR] }), riser, two, false, { avoid: { drain: { wallId: 'GONE', positionMm: 10 } }, waterTrunk: 'high' })` has no `avoidMm` and `waterTrunkMm: 1000`; with `{}` route the result `toEqual` the no-route call (`a spot on a wall the room no longer has is ignored`). And `routeOf({ waterTrunk: 'sky' as never, pipeAvoid: { water: { wallId: 'A', positionMm: NaN } } })` → `{}`.

- [ ] **Step 2: Run and see them fail**

Run: `cd frontend && ~/.local/node/bin/npx vitest run src/lib/__tests__/pipeScheme.test.ts`
Expected: the new tests FAIL (unknown `avoidMm`/`waterTrunkMm` have no effect), the old ones PASS.

- [ ] **Step 3: Implement** in `pipeScheme.ts`:
  - In `trunkOf`, after today's cut loop, apply the spec's rule (§ C "The rule, extended"):

```ts
if (avoidMm !== undefined) {
  const v = norm(avoidMm)
  const anyDoor = gaps.some((g) => g.door)        // collect {a, len, door} per gap in the loop above
  const i = gaps.findIndex((g) => { const f = norm(v - g.a); return f > EPS && f < g.len - EPS })
  if (i >= 0 && (!anyDoor || gaps[i].door)) { cut = i; cutLen = gaps[i].len; cutDoor = gaps[i].door }
}
```
  - `buildScheme`: `const trunkMm = input.waterTrunkMm ?? WATER_TRUNK_MM`; water `doors = trunkMm === 0 ? [] : input.doorsMm`; branch length `|h − trunkMm|`; `base = kind === 'hot' ? trunkMm + 50 : trunkMm` (replace `HOT_DRAWN_MM` with `HOT_ABOVE_MM = 50`); default `fromHeightMm` likewise; pass `input.avoidMm?.water` to water `trunkOf` calls (tee and collector) and `input.avoidMm?.drain` to the drain's.
  - `schemeInput`: `avoidMm` from `place(spot.wallId, spot.positionMm)` per kind (omit nulls; omit the object when empty); `waterTrunkMm` only when `route.waterTrunk` is set.

- [ ] **Step 4: Run** the same command. Expected: all PASS, including `the shared fixture` (old cases unchanged).

- [ ] **Step 5: Append fixture cases** to `pipeScheme.json`, each with a `route` key (studio shape: `{ avoid?: {water?|drain?: RiserAt}, waterTrunk? }`) on a real geometry (reuse the first case's room): drain avoid; water one-door ignored; water no-door; two doors; spot on a point; gone wall; collector + avoid; floor + door; high. Generate `input`/`expected` with a throwaway script calling `schemeInput`/`pipeScheme` (do not commit the script); read each against the rule. Extend the fixture test to pass `c.route ?? {}`. Update the file's `_doc` to mention `route`.

- [ ] **Step 6: Run** vitest for the file. Expected: PASS.

- [ ] **Step 7: Commit** `frontend/src/lib/pipeScheme.ts`, the test, the fixture — `feat(pipes): avoid spot and water trunk height in the scheme rule`.

### Task 2: Backend rule — same change

**Files:**
- Modify: `backend/app/services/pipe_scheme.py`
- Test: `backend/tests/test_pipe_scheme.py`

**Interfaces:**
- Consumes: the fixture cases from Task 1 (`route` key).
- Produces: `scheme_input(geometry, riser, points, collector=False, route: dict | None = None)`, `pipe_scheme(…same…)`, `route_of(ds: dict) -> dict` (same filtering as `routeOf`), `_trunk(…, avoid: float | None = None)`, `HOT_ABOVE_MM = 50`.

- [ ] **Step 1: Failing test:** in both parametrised tests pass `case.get("route")` as `route`; add `test_route_of_keeps_only_sound_values` mirroring Task 1's `routeOf` test.
- [ ] **Step 2: Run** `cd backend && pytest tests/test_pipe_scheme.py -q`. Expected: the new route cases FAIL.
- [ ] **Step 3: Implement** the same three changes as Task 1 Step 3 in Python (keep the `_js_round` calls and the `place()` path).
- [ ] **Step 4: Run** the same command. Expected: PASS (all 17 old + new cases).
- [ ] **Step 5: Commit** — `feat(pipes): the estimate's scheme follows the route`.

### Task 3: DesignState keys and the studio callers

**Files:**
- Modify: `frontend/src/store/types.ts` (after `waterScheme`), `frontend/src/lib/plumbingRuns.ts:90`, `frontend/src/pages/studio/three-d/PlumbingPoints3D.tsx`, `frontend/src/components/studio/design-panel/SantexnikaSection.tsx:108`
- Test: `frontend/src/store/__tests__/plumbingRiser.test.ts` (new `describe`), `frontend/src/lib/__tests__/pipeScheme.test.ts`

**Interfaces:**
- Consumes: `PipeRoute`, `routeOf`, `WATER_TRUNK_HEIGHTS` (Task 1).
- Produces: `DesignState.pipeAvoid?: { water?: RiserAt; drain?: RiserAt }`, `DesignState.waterTrunk?: 'floor' | 'high'`; `plumbingSummary(geometry, points, riser, collector = false, route: PipeRoute = {})`; `collectorFeed(geometry, riser, trunkMm = 200)`.

- [ ] **Step 1: Failing tests:**
  - store: `setDesignState({ waterTrunk: 'high', pipeAvoid: { drain: { wallId: 'A', positionMm: 500 } } })` → one undo step restores both to `undefined`; `isDirty` true; `persistableDesignState` keeps both (save → load round trip through the existing save/load helpers used in `plumbingRiser.test.ts`).
  - `plumbingSummary(g, pts, riser, false, { waterTrunk: 'high' }).water.m` > the no-route value for points at 550/1050 mm.
  - `collectorFeed(g, riser, 0)` points have `y === 0`.
- [ ] **Step 2: Run** `npx vitest run src/store/__tests__/plumbingRiser.test.ts src/lib/__tests__/pipeScheme.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement:** add the two keys with doc comments (spec § C wording); thread `route` through `plumbingSummary`; in `PlumbingPoints3D` read `useRoomStore((s) => s.designState.pipeAvoid)` and `…waterTrunk` (two selectors, then `useMemo(() => routeOf({ pipeAvoid, waterTrunk }))`), pass to `pipeScheme` and `collectorFeed`; same in `SantexnikaSection`.
- [ ] **Step 4: Run** the same tests + `npx tsc -b` (then delete the emitted files, see Global Constraints). Expected: PASS, no type errors.
- [ ] **Step 5: Commit** — `feat(pipes): keep the route in designState and draw with it`.

### Task 4: Estimate reads the route; floor trunk not chased

**Files:**
- Modify: `backend/app/services/smeta.py` (`_plumbing_lines` ~L2224, `_chase_lines` L2654)
- Test: `backend/tests/test_smeta_pipe_scheme.py`, `backend/tests/test_smeta_plumbing_demolition_chase.py`

**Interfaces:**
- Consumes: `pipe_scheme(…, route)`, `route_of` (Task 2).
- Produces: `_chase_lines(pipes: dict, norms: dict, water_trunk_in_floor: bool = False)`.

- [ ] **Step 1: Failing tests:**
  - `test_no_route_keys_price_as_before`: an existing test room's santexnika lines (label, qty, subtotal) captured with the current code as a literal list, asserted equal after the change.
  - `test_drain_avoid_changes_the_drain_metres`: room with `designState.pipeAvoid.drain` set to a spot in the riser-side gap → Ø50 qty equals `round2(6000/1000 × 1.15)` for the Task 1 layout (use the fixture's room).
  - `test_floor_trunk_chases_branches_only`: `designState.waterTrunk = "floor"` → «Ish: shtroba (suv quvuri)» qty = water `branchMm/1000`, formula `"Tik bo'laklar X m × 35 000 so'm"` (the drain chase's existing form, already translated by `smeta_text`).
- [ ] **Step 2: Run** `pytest tests/test_smeta_pipe_scheme.py tests/test_smeta_plumbing_demolition_chase.py -q`. Expected: the new tests FAIL, the snapshot PASSES.
- [ ] **Step 3: Implement:** `route = route_of(_design_state(room))`; `pipe_scheme(geometry, riser, points, collector, route)`; `_chase_lines(scheme["pipes"], norms, route.get("waterTrunk") == "floor")` — in floor mode water metres = `branchMm` and the formula uses the «Tik bo'laklar» form.
- [ ] **Step 4: Run** `pytest tests -q -k "smeta or pipe or plumbing"`. Expected: PASS.
- [ ] **Step 5: Commit** — `feat(smeta): price the pipe route; a floor trunk is not chased`. Open **PR 1** (`feat/pipe-route-rule`), body lists the spec, the no-change guarantee and «merge qilinmasin».

---

## PR 2 — Prices endpoint and the cost difference

### Task 5: `pipeCost` on the front, pinned by a money fixture

**Files:**
- Modify: `frontend/src/lib/pipeScheme.ts`
- Create: `frontend/src/lib/__tests__/fixtures/pipeCost.json`
- Test: `frontend/src/lib/__tests__/pipeCost.test.ts` (new)

**Interfaces:**
- Consumes: `PipeScheme`.
- Produces:

```ts
export interface PlumbingPrices {
  reserve: number
  pipe_m_uzs: { water_20: number; drain_50: number; drain_110: number }
  fitting_uzs: Record<keyof PipeScheme['fittings'], number>
  collector: { shop_uzs: number | null; base_uzs: number; outlet_uzs: number; work_uzs: number }
  chase_m_uzs: { water_20: number; drain_50: number }
}
export function pipeCost(s: PipeScheme, p: PlumbingPrices, o: { pipesInWall: boolean; waterTrunkInFloor: boolean }): number
```

Mirrors `smeta.py`: per line `subtotal = floor(round(qty × price × 100) / 100)` (`_make_line`'s tiyin arithmetic); pipe qty `round2(mm/1000 × reserve)` (`_round2` = `Math.floor(x*100+0.5)/100`); fitting `count × price`; collector per kind with outlets > 0: `shop_uzs ?? base + outlets × outlet`, plus `work × kinds`; chase (when `pipesInWall`) water `round2((floor ? branch : trunk+branch)/1000)`, drain Ø50 `round2(branch/1000)`.

- [ ] **Step 1: Write the fixture** `pipeCost.json`: `{ _doc, prices, cases: [{ name, caseName, route?, pipesInWall, expectedUzs }] }` where `caseName` names a `pipeScheme.json` case (reuse its room). ≥ 5 cases: tees, collector, collector with `shop_uzs`, `pipesInWall: false`, floor trunk. `prices` = the norms in `backend/app/data/plumbing_norms.json`. Compute `expectedUzs` by hand from the formulas above and write the arithmetic in each case's `why` string.
- [ ] **Step 2: Write the test**: for each case `pipeCost(pipeScheme(...case room..., route), prices, opts)` `toBe(expectedUzs)`; plus `pipeCost(EMPTY_SCHEME, prices, …) === 0`.
- [ ] **Step 3: Run** `npx vitest run src/lib/__tests__/pipeCost.test.ts`. Expected: FAIL (`pipeCost` not exported).
- [ ] **Step 4: Implement** `pipeCost`.
- [ ] **Step 5: Run**. Expected: PASS. If a hand value disagrees, re-check the hand arithmetic against `smeta.py` before touching code.
- [ ] **Step 6: Commit** — `feat(pipes): pipeCost mirrors the estimate's pipe money`.

### Task 6: `plumbing_prices()` and the endpoint

**Files:**
- Modify: `backend/app/services/smeta.py`, `backend/app/routers/estimate.py`
- Test: `backend/tests/test_plumbing_prices.py` (new), `backend/tests/test_smeta_pipe_scheme.py`

**Interfaces:**
- Produces: `plumbing_prices(catalog: dict, norms: dict) -> dict` (the `PlumbingPrices` shape, `reserve = PLUMBING_RESERVE`); `GET /rooms/{room_id}/plumbing-prices` on `estimate.router`, response = that dict. Guests are users with rooms, so the same route serves them (no second endpoint; spec § D's guest note is resolved this way).

- [ ] **Step 1: Failing tests:**
  - `test_prices_are_what_the_estimate_uses`: norms only → equals the norms file values; with a catalog `pipe:water_20` shop product sold per m → `pipe_m_uzs.water_20` is the shop price; with an admin override (via `norm_overrides`, as existing override tests do) → overridden value; catalog `kollektor` sold by `dona` → `collector.shop_uzs`.
  - `test_money_fixture_matches_the_estimate`: for each `pipeCost.json` case, build the room from its `pipeScheme.json` room (`_metres`), monkeypatch `load_plumbing_norms` to the fixture `prices` mapped back to norms keys, run `_plumbing_lines`, sum `subtotal_uzs` of the pipe, fitting, collector and chase lines (by their labels: `PIPE_LABELS`, `PLUMBING_FITTING_LABELS`, «Kollektor», «Ish: kollektorni yig'ish», «Ish: shtroba»), assert `== expectedUzs`.
  - Endpoint: 200 with the shape for the owner; 404 for another user's room (same helper as `preview_estimate`).
- [ ] **Step 2: Run** `pytest tests/test_plumbing_prices.py tests/test_smeta_pipe_scheme.py -q`. Expected: FAIL.
- [ ] **Step 3: Implement** `plumbing_prices` and make the pipe, fitting, collector and chase lines read their prices from it (one source). Endpoint: `_load_room_for_pricing` + `load_estimate_catalog`, return `plumbing_prices(catalog, load_plumbing_norms())`.
- [ ] **Step 4: Run** `pytest tests -q -k "smeta or pipe or plumbing or estimate"`. Expected: PASS.
- [ ] **Step 5: Commit** — `feat(smeta): one price source for pipes, served to the studio`.

### Task 7: Prices in the studio store

**Files:**
- Create: `frontend/src/lib/api/plumbingPrices.ts`
- Modify: `frontend/src/store/slices/plumbingSlice.ts`, the studio's room-open effect (where `previewEstimate`/room load runs for a bathroom/kitchen — find with `git grep -n "previewEstimate" frontend/src/pages/studio`)
- Test: `frontend/src/store/__tests__/plumbingPrices.test.ts` (new)

**Interfaces:**
- Produces: `getPlumbingPrices(roomId: string): Promise<PlumbingPrices>` (`apiClient`, GET `/rooms/${roomId}/plumbing-prices`); store `plumbingPrices: PlumbingPrices | null`, `loadPlumbingPrices(roomId: string): Promise<void>` (sets null on failure, never throws); excluded from `partializeTemporal` and from the saved state.
- [ ] **Step 1: Failing tests:** load success sets the value; failure leaves `null`; an undo does not touch it; it is not in the persisted partialize output.
- [ ] **Step 2: Run** `npx vitest run src/store/__tests__/plumbingPrices.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement**; call `loadPlumbingPrices` once when a bathroom/kitchen room opens in the studio.
- [ ] **Step 4: Run** + `tsc -b`. Expected: PASS.
- [ ] **Step 5: Commit** — `feat(studio): load the room's pipe prices`. Open **PR 2**.

---

## PR 3 — Grow animation

### Task 8: `pathToPoint`

**Files:**
- Modify: `frontend/src/lib/pipeScheme.ts`
- Test: `frontend/src/lib/__tests__/pipeScheme.test.ts`

**Interfaces:**
- Produces: `export function pathToPoint(geometry: RoomGeometry, scheme: PipeScheme, riserMm: number, pointId: string, hiddenWalls?: ReadonlySet<string>): Array<[number, number, number]>` — world points from the riser along the point's trunk line (the stretch between the riser's and the point's loop positions inside that line's `fromMm…toMm`, corners included, 40 mm off the wall as `schemePolylines` draws) then the branch end; `[]` for an unknown point or one on a hidden wall. Reuse `schemePolylines`' `at`/`wallAt` by extracting them into a module-private `walkFrame(geometry)` (no behaviour change; the existing `schemePolylines` tests prove it).
- [ ] **Step 1: Failing tests:** for the `schemePolylines` describe's room: path to `c2` (on B) starts at the riser's plan spot at y 0.2, passes the corner, ends at y 1.05; its length equals the trunk distance riser→c2 (− corner offsets as the existing length test does) + 0.85; a point on the left arm walks the other way; unknown id → `[]`; hidden wall → `[]`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `feat(pipes): the path from the riser to a point`.

### Task 9: Growing in the 3D

**Files:**
- Create: `frontend/src/pages/studio/three-d/usePipeGrow.ts`
- Modify: `frontend/src/pages/studio/three-d/PlumbingPoints3D.tsx`
- Test: `frontend/src/pages/studio/three-d/__tests__/usePipeGrow.test.ts` (new)

**Interfaces:**
- Consumes: `pathToPoint` (Task 8).
- Produces: `usePipeGrow(opts: { pointIds: readonly string[]; enabled: boolean; suppress: boolean }): { growing: ReadonlyMap<string, number>; wholeScheme: number | null }` — `growing` maps a point id to its progress 0…1; `wholeScheme` the once-per-session progress. Pure helpers exported for tests: `newPointIds(prev: readonly string[], next: readonly string[]): string[]`, `growProgress(elapsedMs: number, durationMs: number): number` (ease-out cubic, clamped), `partialPolyline(points, t): points` (by arc length). `export function regrowPoints(ids: string[]): void` (module-level trigger used by Task 12 after a pick, 500 ms).
- `suppress` is true while any drag is in progress (`plumbingDragging`, riser/rail/machine drags — read the existing drag flags in the store), during undo/redo (wrap: compare `useRoomStore.temporal` past length change), on the first render after a room load, under `matchMedia('(prefers-reduced-motion: reduce)')`, and in capture/render paths (`useCanvasCapture` flag).
- [ ] **Step 1: Failing tests:** `newPointIds(['a'], ['a','b']) → ['b']`; `growProgress(350, 700)` ≈ 0.875, `growProgress(800, 700) === 1`; `partialPolyline` at t 0.5 of an L-shape ends mid-length; hook (renderHook + fake timers): a new id grows to 1 in 700 ms; with `suppress` true no entry appears; reduced motion → none; whole scheme runs once per session (second enable → `null`), 1200 ms.
- [ ] **Step 2: Run** `npx vitest run src/pages/studio/three-d/__tests__/usePipeGrow.test.ts` → FAIL.
- [ ] **Step 3: Implement**; in `PlumbingPoints3D` while a point grows, draw its `pathToPoint` cut by `partialPolyline` in its colour (lineWidth 3) with a small emissive head sphere (r 0.02), and hide that point's own branch until done; while `wholeScheme < 1` draw every polyline cut at that progress (trunks first half, branches second half). `useFrame` drives progress; no state set per frame (refs + a single re-render on start/end).
- [ ] **Step 4: Run** + `tsc -b` → PASS.
- [ ] **Step 5: Manual check** in the browser preview (bathroom, Quvurlar): add a point → grows; drag it → no replay; undo → no replay. Screenshot for the PR.
- [ ] **Step 6: Commit** — `feat(studio): pipes grow from the riser`. Open **PR 3**; owner phone QA (WebView smoothness on Android).

---

## PR 4 — Tap a pipe, the card

### Task 10: Hit tubes and the tap

**Files:**
- Create: `frontend/src/pages/studio/three-d/pipeTap.ts`
- Modify: `PlumbingPoints3D.tsx`, `Riser3D.tsx`, `TowelRails3D.tsx`, `Washers3D.tsx`, `features/studio/StudioFurniture.tsx` (set `userData.pressItem = true` on their pickable meshes)
- Test: `frontend/src/pages/studio/three-d/__tests__/pipeTap.test.ts` (new; real `OrbitControls` on a stand-in canvas, as `radialCloseThenDrag.test.tsx`)

**Interfaces:**
- Consumes: `DRAG_SLOP_PX`, `claimItemPress`, `itemPressClaimed` (`pressDrag.ts`), `multiTouchGuard()`.
- Produces: `export const PIPE_TAP_MS = 500`; `export function itemInFront(intersections: ReadonlyArray<{ object: THREE.Object3D; distance: number }>, pipeDistance: number): boolean` (any `pressItem` object, walking up `parent`s, with `distance < pipeDistance + 0.15`); `export function createPipeTap(opts: { onTap: (e: PointerEvent) => void; pinch?: MultiTouchGuard; now?: () => number; target?: EventTarget }): { press(e: { pointerId: number; clientX: number; clientY: number }): void; dispose(): void }`. In the 3D: one invisible tube mesh per `SchemePolyline` (`TubeGeometry` over a `CatmullRomCurve3` with `curveType: 'chordal'`, tension 0, or per-segment cylinders — builder's pick), radius 0.05 m when `matchMedia('(pointer: coarse)')` else 0.03, `userData.pipe = { kind, diameterMm }`; `onPointerDown`: if `itemInFront(e.intersections, e.distance)` return (no stopPropagation); else `e.stopPropagation()`, `claimItemPress()`, `tap.press(e.nativeEvent)`.
- [ ] **Step 1: Failing tests:** `a tap opens` (down/up same spot, 100 ms → `onTap` once); `a move of 6 px is the camera's` (no tap; OrbitControls azimuth changed); `a second finger is a pinch` (no tap); `a hold of 500 ms does nothing`; `the wall ring never opens for a pipe press` (`itemPressClaimed()` true after press); `a press on a disc in front of a pipe is the disc's` (`itemInFront` true for a `pressItem` 0.03 m nearer, false for one 0.3 m farther).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** + existing `pressDrag.test.ts`, `wallRingItemPress.test.ts`, `radialCloseThenDrag.test.tsx` → PASS.
- [ ] **Step 5: Commit** — `feat(studio): pipes can be tapped`.

### Task 11: Pipe selection

**Files:**
- Create: `frontend/src/features/studio/pipeSelection.ts`
- Modify: `frontend/src/pages/studio/three-d/useExclusiveSelection.ts`, the stage-switch handler (`PhaseStageNav` / `ThreeDPage` — where the fixture selection is cleared today)
- Test: `frontend/src/features/studio/__tests__/pipeSelection.test.ts` (new)

**Interfaces:**
- Produces: `export interface PipeSel { kind: SchemeKind; group: 'water' | 'drain'; at: RiserAt; world: [number, number, number] }`; `usePipeSelection = create<{ sel: PipeSel | null; select(sel: PipeSel | null): void }>`; `export function pipeSpotAt(geometry: RoomGeometry, world: THREE.Vector3): RiserAt` (nearest wall-walk spot, mm). `dropFixture` in `useExclusiveSelection` also drops the pipe; `selectFixture` and every non-null select clear it; `selectPipe(sel)` clears the others.
- [ ] **Step 1: Failing tests:** selecting furniture/fixture/opening/light clears the pipe; selecting a pipe clears a fixture; `clearAll` clears it; stage switch clears it; `pipeSpotAt` on a point 40 mm off wall B at 500 mm → `{ wallId: 'B', positionMm: 500 }`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**; Task 10's `onTap` sets the selection (`group = kind === 'drain' ? 'drain' : 'water'`). The tapped polyline is drawn lineWidth +2 with `emissiveIntensity` glow while selected.
- [ ] **Step 4: Run** → PASS. **Step 5: Commit** — `feat(studio): a pipe selection`.

### Task 12: Card options and the `PipeCard`

**Files:**
- Create: `frontend/src/lib/pipeOptions.ts`, `frontend/src/pages/studio/three-d/PipeCard.tsx`
- Modify: `ThreeDCanvasScene.tsx` (mount the card next to `FixtureCard`), `frontend/src/i18n/locales/{uz,ru,en}.json`
- Test: `frontend/src/lib/__tests__/pipeOptions.test.ts`, `frontend/src/pages/studio/three-d/__tests__/PipeCard.test.tsx` (new)

**Interfaces:**
- Consumes: `pipeScheme`, `schemeInput`, `trunkOf` legality (export `export function avoidIsLegal(input: SchemeInput, group: 'water' | 'drain', spotMm: number): boolean` from `pipeScheme.ts`, reusing the Task 1 gap logic), `pipeCost`, `PlumbingPrices`, `usePipeSelection`, `regrowPoints`.
- Produces:

```ts
export interface PipeDelta { m: number; uzs: number | null }        // m: reserve-applied, 1 decimal; uzs null without prices
export interface PipeOptions {
  title: 'title_cold' | 'title_hot' | 'title_drain'; wide: boolean; lengthM: number
  way: { kind: 'other'; delta: PipeDelta } | { kind: 'back'; delta: PipeDelta } | { kind: 'one_way_door' }
  height?: Record<'floor' | 'default' | 'high', PipeDelta | 'current'>
  join?: Record<'tee' | 'collector', PipeDelta | 'current'>
}
export function pipeOptions(args: { geometry: RoomGeometry; riser: RiserAt; points: readonly PlumbingPoint[]; ds: DesignState; sel: PipeSel; prices: PlumbingPrices | null }): PipeOptions | null
```
Returns `null` when the selected kind has no points any more (the card then closes). `way.kind` is `'back'` when `ds.pipeAvoid[group]` is set, `'other'` when `avoidIsLegal`, else `'one_way_door'`. Deltas = alternative minus current, with `pipeCost` (`pipesInWall: ds.pipesInWall !== false`); `m` from water or drain metres (reserve-applied) of the alternative minus current; `uzs` rounded to 1 000.

- [ ] **Step 1: Failing `pipeOptions` tests** (Task 1 room, one door): cold pipe → `way.kind === 'one_way_door'`; drain → `'other'` with `delta.m > 0` (Task 1's layout: the trunk goes 5000 → 6000 mm); after setting the avoid → `'back'`; `height.default === 'current'`, `height.high.m > 0`; `join.collector.uzs` > 0 with prices; `prices: null` → every `uzs === null` (`no prices: metres only`); kind with no points → `null` (`the card closes when its pipe is gone`).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement `pipeOptions`** (≤ 6 `pipeScheme` calls). **Step 4: Run** → PASS.
- [ ] **Step 5: Failing `PipeCard` tests** (RTL, i18n `uz`): renders title «Sovuq suv quvuri · 4,6 m»-style text from `lengthM`; «Eshik sabab yo'l bitta» for the one-way case and no button; tapping «Boshqa tomondan aylanib o'tsin» calls `setDesignState({ pipeAvoid: { …, drain: sel.at } })` once and `regrowPoints`; «Avvalgi yo'lga qaytarish» removes that group's key (and the whole `pipeAvoid` when empty → `undefined`); height chip «1 m» → `waterTrunk: 'high'`, «20 sm» → `waterTrunk: undefined`; join chip → `waterScheme`; each non-current option shows its delta («+1,2 m quvur, +45 000 so'm», `−` values in the green class, zero → «Smeta o'zgarmaydi», no prices → «… m quvur» + «Narx yuklanmadi»); after a pick a 3 s toast with the delta; ✕ closes; `ru` and `en` render their titles.
- [ ] **Step 6: Run** → FAIL. **Step 7: Implement `PipeCard`** with `FixtureCard`'s `Html` placement and narrow-screen docking; i18n keys exactly from the spec's table under `studio.santexnika.pipe_card.*` (phase-2 `pipe_tip.*` keys are **not** added now). Number format: `formatDecimal`, so'm with the existing thousands formatting.
- [ ] **Step 8: Run** card tests + `src/i18n/__tests__/locales.test.ts` + `tsc -b` → PASS.
- [ ] **Step 9: Commit** — `feat(studio): the pipe card with its cost difference`.

### Task 13: Phone QA checklist and PR

**Files:**
- Create: `docs/qa/2026-11-2x-quvur-karta-telefon.md` (date of the PR)

- [ ] **Step 1: Write the checklist** (Uzbek, a table: qadam / kutilgan / ✓): tap a thin pipe near a point and near a wall; pinch starting on a pipe; one-finger turn starting on a pipe; hold on a pipe; ring open → tap pipe; open card + turn camera; drag the riser with the card open; each option's so'm vs the Smeta tab after the pick; guest room; offline (airplane mode) → metres only; reduced-motion setting on iOS; uz/ru/en.
- [ ] **Step 2: Browser-preview check** of the whole flow (desktop + `resize_window` mobile), screenshots in the PR.
- [ ] **Step 3: Commit** the QA doc — `docs(qa): pipe card phone checklist`. Open **PR 4**; send the checklist to the mobile session for WebView QA; wait for the owner's «merge qil».

---

## Not in this plan

- Spec § E (smart tip) — phase 2, its own plan after MVP feedback.
- More trunk heights, per-point routing, a "cheapest" button.
