# Auto pipes, made memorable and easy to adjust (pipe UX)

Date: 2026-11-24 · Status: **approved by the owner 2026-11-24** (incl. the five calls below) · Spec only, no code yet

## Intent

The owner watched a plumbing video and asked whether users should draw pipes by hand. Decided
(owner + mobile session, 2026-11-24): **the studio keeps drawing the pipes itself**, and the work
goes into making that automatic scheme *memorable* (you see it being laid) and *adjustable a
little* (a few safe choices, each with its cost shown at once).

Why: the user is not a plumber, drawing in 3D on a phone is hard, and hand-drawn pipes would break
the estimate. A scheme the user can see grow, tap and nudge feels like theirs without any of that.

## Goals

- When a point appears, its pipe visibly **grows** from the riser to it, in the pipe's colour.
- A pipe can be **tapped** (phone first) and opens a small card with up to three choices: which way
  round the trunk goes, the water trunk's height, tees or a collector.
- Every choice shows its **estimate difference before and after it is picked**, in metres and in
  so'm («+1,2 m quvur, +45 000 so'm»), worked out on the phone with no round trip.
- The studio and the estimate keep giving **one scheme and one price** for a room: the rule stays
  shared and pinned by `frontend/src/lib/__tests__/fixtures/pipeScheme.json`.
- Phase 2: one **smart tip** at a time that saves real pipe («Mashinani stoyakka 1 m yaqinroq
  qo'ysangiz, 3 m quvur tejaladi»).

## Non-goals

- No hand drawing, no dragging a pipe, no free waypoints. (Decided, see Intent.)
- No pipes through the ceiling or across the floor diagonal: the trunk stays a walk along the walls.
- No change to how points, the riser or fixtures are placed or dragged today.
- No new estimate lines or prices; only the existing pipe, fitting, collector and chase lines change
  through their inputs.

## Anti-goals (a failure even if it works)

- A pipe tap that steals a wall-ring open, a fixture drag or a camera turn/pinch.
- A choice whose shown cost differs from what the estimate then says.
- A water pipe drawn through a doorway.
- An existing room whose scheme or estimate changes without the user picking something.
- Animation that replays on every drag frame, or that slows the phone WebView.

## What exists today (read before building)

| Piece | Where | Notes |
|---|---|---|
| The rule | `frontend/src/lib/pipeScheme.ts` `buildScheme` / `trunkOf`; `backend/app/services/pipe_scheme.py` `build_scheme` / `_trunk` | One trunk per kind along the walls; the **cut** is the largest gap between distinct positions (riser + points) that holds a door, else the largest gap. Water trunks get the room's doors; drains get none (they pass under doors, owner 2026-11-11). |
| Parity | `frontend/src/lib/__tests__/fixtures/pipeScheme.json`, `pipeScheme.test.ts`, `backend/tests/test_pipe_scheme.py` | Same normalised input → same scheme. |
| Colours | `PIPE_COLOUR` in `pipeScheme.ts` | cold `#3B82F6`, hot `#EF4444`, drain `#475569` (already the proposal's colours). |
| Drawing | `PlumbingPoints3D.tsx` | drei `Line`, 2 px (Ø110: 4 px), recomputed with `useMemo` on any store change, so riser/point drags redraw already. Not tappable. |
| Water layout | `designState.waterScheme` (`'collector'` or absent), select in `SantexnikaSection.tsx` | Read by `smeta.py` via `_design_state(room)`. |
| Estimate | `smeta.py` ~L2205–2255: pipe lines (`× PLUMBING_RESERVE` 1.15, shop price or `pipe_m_uzs` norm), fitting lines, `_collector_lines`, `_chase_lines` (if `pipesInWall` is not false) | Prices are backend-only (norms + admin overrides + shop products). The front knows metres only (`plumbingSummary`). |
| Gestures | `pressDrag.ts` (`DRAG_SLOP_PX = 6`, `claimItemPress`, `createPressDrag`), `lib/multiTouchGuard.ts`, `useSurfaceRadialMenu.ts`, `FixtureCard.tsx`, `useExclusiveSelection.ts` | Rails, machines and the riser claim their press so the wall ring does not open; pinch cancels before slop. |

**The door fact behind the owner's first decision:** in a room with one door only one gap holds
the door, so a water trunk has exactly one legal route. «Chapdan / O'ngdan» is therefore offered
only where a second legal route exists, mostly for the drain (owner: «Faqat tanlov bor joyda»).

## Phasing

| Phase | What | Why this order |
|---|---|---|
| **MVP (1)** | A. Grow animation · B. Tappable pipes + card (way round, water trunk height, tees/collector) · C. Prices endpoint + instant cost difference · D. Redraw on drag (kept, no replay of the animation) | A is the "memorable" part and front-only; B+C are the "adjust a little" part and only make sense together (a choice without its price was rejected). |
| **2** | E. Smart tip | Needs a search over moves and copy tuning; best built once real users have tapped the card. |
| Later / not planned | More trunk heights, per-point routing, a "cheapest" auto button | Not asked for; revisit after phase 2. |

## Decisions (owner, 2026-11-24)

| # | Question | Decision |
|---|---|---|
| 1 | «Chapdan / O'ngdan» with only one legal route | Shown **only where a second legal route exists**; otherwise a short note «Eshik sabab yo'l bitta». |
| 2 | Cost difference in so'm | **A prices endpoint**: the backend sends the room's per-metre / per-piece prices once, the phone works the difference out instantly. |
| 3 | «Balandlik» | The **water trunk's height, three presets**: Polda / 20 sm / 1 m. |
| 4 | How the chosen way round is kept | **An "avoid" spot**: the place the user said the pipe should not run (wall + mm), kept in `designState`. |

## Design

### A. Grow animation (MVP)

- **When:** a point that was not in the last drawn scheme appears (added by hand, a fixture placed,
  a rail or a machine added, a design applied). Also **once** when the Quvurlar layer is first shown
  in a session: the whole scheme grows, trunks first, then branches (≤ 1.2 s total).
- **What grows:** the path from the riser to that point: along its trunk stretch from the riser to
  the point's loop position, then up/down its branch. A new helper `pathToPoint(scheme, pointId):
  loop positions + heights` (pure, in `pipeScheme.ts`) gives it; `schemePolylines`' corner/hidden-wall
  handling is reused to turn it into world points.
- **How:** a per-frame partial polyline by arc length (`useFrame`), ease-out, ~0.7 s for one point;
  a soft brighter "head" dot at the growing tip in the pipe's colour. Existing pipes stay drawn.
- **Not animated:** drags (riser, points, fixtures: the scheme just redraws, as today), undo/redo,
  room load, stage switches after the first, renders/thumbnails/panorama (never animated: they
  always show the finished scheme), `prefers-reduced-motion: reduce` (no animation at all).
- Several points at once (a design applied): grow together, one duration.

### B. Tappable pipes and the pipe card (MVP)

**Hit target.** Each drawn `SchemePolyline` gets an invisible tube along it (radius 5 cm on touch,
3 cm with a mouse; `visible={false}` material with raycast kept), only while the pipe layer is
shown. The visible `Line` stays as is.

**Who wins a press (priority):** point disc / riser / rail / machine / furniture → pipe → wall/floor.
The tube lies 4 cm off the wall, in front of the point discs (1 cm), so the pipe's `onPointerDown`
must step aside when an item is also hit: if any of `e.intersections` (within 0.15 m of the pipe hit)
is an object flagged `userData.pressItem` (set on discs, riser, rails, machines, furniture), the pipe
does nothing and does not stop propagation.

**Gesture** (no drag: pipes are not movable, so `createPressDrag` is *not* used and the camera keeps
its one-finger turn):

| Input on a pipe | Result |
|---|---|
| Press, release within `DRAG_SLOP_PX` (6 px) and < 500 ms, no second finger since the press (`multiTouchGuard.multiTouchSince(pressAt)` false) | Opens the card at the tapped spot |
| Press then move ≥ 6 px | Camera turns as usual; no card |
| Second finger (pinch) at any time before release | Camera pinch; no card |
| Hold ≥ 500 ms | Nothing (no delete menu: a pipe cannot be deleted) |
| Any press on the pipe | `claimItemPress()` at pointerdown, so the wall/floor behind never opens its radial ring for it (hold timer or trailing click) |
| Wall ring already open | Its backdrop takes the tap and closes the ring first (as today); the next tap reaches the pipe |

The pipe selection is one more kind in `useExclusiveSelection` / `fixtureSelection`: opening it
closes a fixture card, and selecting a fixture, tapping empty space or switching stage closes it.
The tapped pipe is drawn thicker with a light glow while its card is open.

**The card** (same look and placement as `FixtureCard`: an `Html` card at the tapped spot; on a
narrow screen it docks at the bottom like the fixture card does):

```
┌ Sovuq suv quvuri · 4,6 m ──────────── ✕ ┐
│ Yo'l   [ Boshqa tomondan aylanib o'tsin ] │
│        −1,1 m quvur · −18 000 so'm        │
│ Balandlik  (Polda) (●20 sm) (1 m)         │
│            +0,8 m   ·        +2,4 m        │
│ Ulash      (●Troynik) (Kollektor)          │
│                       +1 200 000 so'm      │
└────────────────────────────────────────────┘
```

- **Title:** the kind («Sovuq suv quvuri» / «Issiq suv quvuri» / «Kanalizatsiya quvuri», Ø110 noted
  when the tapped stretch is Ø110) and that kind's total length (trunk + branches, with the reserve,
  as `plumbingSummary` shows it).
- **Yo'l (way round):** for the tapped kind group (water = cold + hot together, drain), if the gap
  holding the tapped spot is a legal cut (see the rule change below), the button «Boshqa tomondan
  aylanib o'tsin» sets the avoid spot to the tapped spot. When an avoid spot is in force for that
  group, the button reads «Avvalgi yo'lga qaytarish» and clears it. When the tapped gap is not a
  legal cut, no button, only the muted note «Eshik sabab yo'l bitta» (water, door). A drain (and a
  floor water trunk) is handed no doors, so every gap is legal and the button always shows.
- **Balandlik:** water pipes only. Three chips: «Polda» (0 mm, in the screed), «20 sm» (today's
  200 mm, default), «1 m» (1000 mm).
- **Ulash:** water pipes only. «Troynik» / «Kollektor»: the same `designState.waterScheme` the panel's
  select writes (the panel select stays; both write one value).
- **Cost under each choice not in force:** the difference against the scheme as it is now: pipe
  metres (with the reserve, one decimal) and so'm (rounded to 1 000), sign shown, `−` in green, `+`
  neutral. «Smeta o'zgarmaydi» when both are zero. Without prices (offline, request failed, guest
  with no prices yet): metres only, plus a muted «Narx yuklanmadi».
- **After a pick:** the scheme redraws at once (the changed stretch grows again, A's animation, 0.5 s),
  a 3 s toast repeats the difference («+0,8 m quvur, +12 000 so'm»), and the change is one undo step
  (it goes through `setDesignState`, which is already undoable and autosaved).
- The drain card shows only «Yo'l». A water card whose «Yo'l» has no button still shows the note,
  the height and the join choices (the user learns why the pipe goes there).

### C. Rule change, storage and parity

**Storage** (no migration: `designState` is a JSON blob in `room.state`, read by `_design_state`):

```ts
interface DesignState {
  // …existing…
  /** Where the user said a trunk must not run (2026-11-24): a place on the walls, as the riser is kept. */
  pipeAvoid?: { water?: RiserAt; drain?: RiserAt }
  /** The water trunks' height (2026-11-24): 'floor' = 0 mm, 'high' = 1000 mm; absent = 200 mm. */
  waterTrunk?: 'floor' | 'high'
}
```

Kept as wall + mm (like `plumbingRiser`) so it means the same place after points, the riser or
fixtures move. A spot on a wall the room no longer has is ignored. Absent keys = today's behaviour
exactly, so every saved room and every existing fixture case is unchanged.

**Normalised input** (both sides, same names):

```ts
interface SchemeInput {
  // …existing…
  /** The avoid spots as loop positions (mm), from designState.pipeAvoid via `place()`. */
  avoidMm?: { water?: number; drain?: number }
  /** The water trunks' height, mm: 0 | 200 | 1000. Absent = 200. */
  waterTrunkMm?: number
}
```

`schemeInput` / `scheme_input` gain the two arguments and normalise them with the existing `place()`
(same rounding), so the backend, reading metres, is handed the same integers.

**The rule, extended** (in `trunkOf` / `_trunk`, after today's cut is chosen; an extra `avoidMm` arg):

1. If `avoidMm` is set, find the gap `i` (between consecutive distinct positions) that holds it
   strictly inside (more than `EPS` from both ends). A spot on a riser/point position holds no gap.
2. The gap is **legal** if: no gap holds a door (for this trunk's door list), or gap `i` holds a door.
   (A water trunk with one door: only the door's gap is legal, so a spot elsewhere is ignored.)
3. If legal, gap `i` is the cut. Otherwise today's cut stands.
4. Collector lines (one trunk per point) use the same water avoid spot, each on its own.

**Heights:** `WATER_TRUNK_MM` becomes the default of `waterTrunkMm`. Water branch length is
`|point height − waterTrunkMm|`; drawn heights: cold at `waterTrunkMm`, hot at `waterTrunkMm + 50`,
collector lines stepping `COLLECTOR_STEP_MM` above those; the collector's feed pipe
(`collectorFeed`) at the trunk height.

**Floor water trunk passes under the door** (my call, consistent with the owner's 2026-11-11 drain
ruling: a pipe in the screed is not in the doorway): with `waterTrunkMm === 0` the water trunks are
handed no doors, like the drain. So a floor trunk may also get the «Boshqa tomondan» choice.
*Approved by the owner 2026-11-24.*

**Chase lines:** a floor water trunk is in the screed, not the wall, so `_chase_lines` chases only the
water branches when `waterTrunk === 'floor'` (today it chases trunk + branches). The formula text
names only «tik bo'laklar» in that case, through the same locale path as today's chase formula.

**The card's options are worked out on the front** by building the alternative schemes (≤ 5 extra
`buildScheme` calls per card open: avoid on/off, three heights, tee/collector) — each is
milliseconds; nothing is cached beyond the open card.

**Parity:** add cases to `pipeScheme.json` (regenerated from the studio code, each read against the
rule) and run them on both sides:

| Case | Expect |
|---|---|
| Drain, avoid spot on the trunk's arm | Cut moves to that gap; Ø110/Ø50 split and fittings follow |
| Water, one door, avoid spot away from the door | Ignored; scheme = no-avoid scheme |
| Water, no door, avoid spot | Cut moves |
| Water, two doors, avoid spot in the other door's gap | Cut moves to it |
| Avoid spot exactly on a point / on the riser | Ignored |
| Avoid on a wall that is gone (input built without it) | Ignored |
| Collector + water avoid | Each line takes the legal side |
| `waterTrunkMm` 0, one door between points | Trunk passes under the door; branches = point heights |
| `waterTrunkMm` 1000 | Branch lengths `|h − 1000|`; drawn heights 1000/1050 |

### D. Prices endpoint and the cost difference (MVP)

**Endpoint:** `GET /api/rooms/{room_id}/plumbing-prices` (same router, auth and room access check as
the room's estimate). Response, the very numbers the estimate would use for this room:

```json
{
  "reserve": 1.15,
  "pipe_m_uzs": { "water_20": 9000, "drain_50": 18000, "drain_110": 42000 },
  "fitting_uzs": { "tee_20": 0, "elbow_20": 0, "outlet_20": 0, "valve_20": 0, "tee_50": 0, "elbow_50": 0, "tee_110_50": 0, "elbow_110": 0 },
  "collector": { "shop_uzs": null, "base_uzs": 0, "outlet_uzs": 0, "work_uzs": 0 },
  "chase_m_uzs": { "water_20": 0, "drain_50": 0 }
}
```

(Values above are shapes, not real prices.) The pipe price is the shop product's per-metre price
when the room's catalog has one, else the norm after admin overrides, exactly the choice the pipe
line makes today. A guest studio (no saved room) calls `GET /api/plumbing-prices` (norms with
overrides, no shop): the builder checks the guest-mode spec (2026-11-20) for which is reachable.

**Backend refactor so the two cannot drift:** pull the pipe / fitting / collector / chase price
picking out of `smeta.py` into one function (`plumbing_prices(catalog, norms)`) used both by the
estimate lines and by the endpoint.

**Front:** fetched once when the studio opens a bathroom/kitchen room, kept in the room store (not
saved, not in undo), fetched again after the shop or admin prices could have changed (studio reopen
is enough for the MVP). A pure `pipeCost(scheme, prices, { pipesInWall, waterTrunk })` in
`pipeScheme.ts` mirrors the estimate: per pipe kind `round2(mm/1000 × reserve) × price`, fittings
`count × price`, collector lines, chase lines. The difference is `pipeCost(alt) − pipeCost(now)`.

**Parity for money:** a `cost` section in `pipeScheme.json`: a scheme input + a price set → expected
`pipeCost` total. The front test checks `pipeCost`; the backend test runs the real estimate for the
same room and asserts the sum of its pipe, fitting, collector and chase lines equals it.

### E. Smart tip (phase 2)

- **Movable things only:** washing machines, dishwashers, kitchen sinks, hand-added points and the
  riser (only if the user already moved it: a riser at the door corner is a real riser). Not catalog
  fixtures (a toilet's place is a design choice).
- **Search (front, after drags end, debounced 500 ms):** for each movable thing, try shifts along its
  wall in 100 mm steps within ±1.5 m that keep today's placement rules (`riserTaken`, clearances,
  rail/machine spacing); compute `pipeCost`. Keep the best saving.
- **Show** one tip at a time, only if it saves ≥ 1 m of pipe *and* ≥ 20 000 so'm (metres only without
  prices): a small chip over the 3D at Quvurlar: «Mashinani stoyakka 1 m yaqinroq qo'ysangiz, 3 m
  quvur tejaladi (−54 000 so'm)» with [Ko'chirish] (moves it, one undo step, grow animation) and [✕].
- A dismissed tip for the same thing and target does not return this session; never more than one
  tip per 60 s; none while a card or ring is open.

## i18n (uz · ru · en)

Keys under `studio.santexnika.pipe_card.*` and `studio.santexnika.pipe_tip.*`, all three locales in
the same PR (the existing locale-key tests must pass):

| Key | uz | ru | en |
|---|---|---|---|
| `title_cold` | Sovuq suv quvuri | Труба холодной воды | Cold water pipe |
| `title_hot` | Issiq suv quvuri | Труба горячей воды | Hot water pipe |
| `title_drain` | Kanalizatsiya quvuri | Канализационная труба | Drain pipe |
| `way` | Yo'l | Трасса | Route |
| `other_way` | Boshqa tomondan aylanib o'tsin | Обойти с другой стороны | Go round the other way |
| `way_back` | Avvalgi yo'lga qaytarish | Вернуть прежнюю трассу | Back to the first route |
| `one_way_door` | Eshik sabab yo'l bitta | Из-за двери путь только один | Only one route: the door is in the way |
| `height` | Balandlik | Высота | Height |
| `height_floor` | Polda | В полу | In the floor |
| `height_20` | 20 sm | 20 см | 20 cm |
| `height_1m` | 1 m | 1 м | 1 m |
| `join` | Ulash | Подключение | Connection |
| `tee` | Troynik | Тройники | Tees |
| `collector` | Kollektor | Коллектор | Manifold |
| `delta` | {{m}} m quvur, {{sum}} so'm | {{m}} м трубы, {{sum}} сум | {{m}} m of pipe, {{sum}} UZS |
| `delta_m` | {{m}} m quvur | {{m}} м трубы | {{m}} m of pipe |
| `no_change` | Smeta o'zgarmaydi | Смета не меняется | The estimate stays the same |
| `no_prices` | Narx yuklanmadi | Цены не загружены | Prices not loaded |
| `pipe_tip.move` (ph. 2) | {{what}}ni stoyakka {{m}} m yaqinroq qo'ysangiz, {{save}} m quvur tejaladi | Если поставить {{what}} на {{m}} м ближе к стояку, сэкономите {{save}} м трубы | Move the {{what}} {{m}} m closer to the riser to save {{save}} m of pipe |
| `pipe_tip.apply` (ph. 2) | Ko'chirish | Переместить | Move it |

Numbers use `formatDecimal` and the existing so'm formatting; the sign is part of `{{m}}`/`{{sum}}`.
The chase formula's new «tik bo'laklar only» text goes into `smeta_locale.json` for all three.

## Test plan

| Area | Tests |
|---|---|
| Rule parity | New `pipeScheme.json` cases (table in C) pass in `pipeScheme.test.ts` and `backend/tests/test_pipe_scheme.py`; all existing cases unchanged |
| Rule units | `trunkOf` avoid: legal/illegal gap, spot on a position, collector, floor trunk with doors handed none |
| Money parity | `cost` fixture cases: front `pipeCost` = backend estimate's pipe+fitting+collector+chase lines (`test_smeta_pipe_scheme.py`) |
| Estimate | `waterTrunk: 'floor'` chases branches only; `pipeAvoid` changes trunk metres and fittings; absent keys = today's lines (snapshot of an existing room) |
| Endpoint | Auth and room access; shop price wins over norm; admin override applied; guest variant; shape matches `pipeCost`'s input type |
| Store | `pipeAvoid` / `waterTrunk` set via `setDesignState`: one undo step, autosave sees it, save → load round trip, stale wall ignored |
| Gestures (vitest, real `OrbitControls` like `radialCloseThenDrag.test.tsx`) | Tap opens the card; move ≥ 6 px turns the camera and opens nothing; second finger → pinch, no card; hold ≥ 500 ms does nothing; press on a disc in front of a pipe drags the point, no card; pipe press never opens the wall ring (`itemPressClaimed`); ring open → first tap closes it |
| Selection | Pipe card and fixture card exclude each other; stage switch closes it |
| Animation | `pathToPoint` units (both arms, across a corner, hidden wall); new point grows once; drag/undo/load do not animate; reduced motion → none; render/thumbnail paths never animate |
| Card | Options hidden/shown per the door rule; deltas from `pipeCost`; no-prices fallback; i18n keys in uz/ru/en |
| Phone QA (WebView, iPhone + Android, `docs/qa/`) | Tap a thin pipe near a point and near a wall; pinch starting on a pipe; open card + rotate; change each option and compare the card's so'm with the Smeta tab |
| Phase 2 | Tip search respects placement rules; thresholds; dismiss memory; [Ko'chirish] is one undo step |

## Left to the builder

- Exact animation easing, head-dot look, glow on the selected pipe.
- Exact router file and URL prefix for the endpoint (match the estimate's).
- Whether the hit tube is built per polyline segment or as one `TubeGeometry` per polyline.
- Card docking breakpoint (follow `FixtureCard`).

## Calls I made (owner: check while reading)

1. A floor water trunk passes under the door (like the drain) and its trunk is not chased in the wall.
2. Cold and hot share one avoid spot («water»): they run together today and a split would confuse.
3. The whole scheme grows once per session when Quvurlar is first shown, not only per new point.
4. Smart tip thresholds: ≥ 1 m and ≥ 20 000 so'm, one tip per 60 s, catalog fixtures never moved.
5. The panel's Troynik/Kollektor select stays, next to the card's chips (one shared value).
