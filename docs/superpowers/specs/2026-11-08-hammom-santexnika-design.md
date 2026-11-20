# Bathroom plumbing: fixtures that know where they go, drain and water points, and a plumbing estimate

**Date:** 2026-11-08 · **Status:** approved in chat, awaiting written-spec review · **Area:** studio furniture layout and panel, new plumbing layer in room state, a "Santexnika" stage, `backend/app/services/smeta.py`

## Why

A sample bathroom was built on prod ("Hammom namunasi", 2.5 × 2.0 × 2.7 m, room type `hammom`) with a bathtub, a sink, a toilet and a shower. It showed what is missing:

1. **The fixtures piled up in the middle of the room**, at (0, 0), (0.3, 0.3), (0.6, 0.6) and again (0, 0) m, one on top of another. Their catalog category is `boshqa`, so the layout reads them as decor and has no rule for them.
2. **The catalog has no notion of a fixture.** All 14 Hansgrohe pieces (Vanna 1–5, Rakovina 1–4, Dush 1–3, Unitaz, Bide) are `category = boshqa`, `room_type = hammom`.
3. **The desktop "3D models" panel ignores the room type.** A bathroom lists Loftbek desks and shelves, and has no plumbing filter: the fixtures hide under "Other". (#207 fixed only the arc menu and the add-furniture sheet.)
4. **There are no drain or water points.** Nothing says where the sewer or the hot and cold water come out, and a fixture connects to nothing.
5. **The estimate treats fixtures as furniture.** It has no plumbing work, no pipes, no fittings. (No waterproofing or tiling either; those are out of scope here.)

**Success means:**

- Fixtures added to a bathroom land where they belong, against walls and in corners, never on top of each other.
- Each fixture brings its drain and water points, shown on the wall in 3D, which the user can move. The user can add points of their own, for example for a washing machine.
- The estimate has a "Santexnika" section: the fixtures at the shop's current price, the pipes and fittings worked out from the points, and the installation work. Every line shows its working.

## Decisions (from the brainstorm)

| Question | Decision |
|---|---|
| How deep is the first version | **Fixtures and points.** Not waterproofing, tiling, towel rails or ventilation (a later step). |
| Where the points come from | **Both.** A fixture brings its points when it is placed; the user may add more points by hand. |
| Where the prices come from | **Shop products and norms**, like the rest of the estimate. Pipes and fittings come from the shop's `santexnika` products, at their real price; if none is found, an average price is used and the line is marked approximate. The installation work is a norm price per point and per fixture. |
| Architecture | **A plumbing layer of its own**, mirroring the electrical points (`electricals`). Not derived at estimate time only (that would rule out hand-added points), and not merged with the electrical layer into one "service points" system (a refactor of working code for no user gain now). |

## Design

### 1. Fixture roles and the points each needs

- `inferRole` (`frontend/src/lib/furnitureRole.ts`) and `infer_role` (`backend/app/services/ai_designer.py`) gain five roles, read from the name in Uzbek, Russian and English. The two copies stay identical, as today:

| Role | Words |
|---|---|
| `bathtub` | vanna, ванна, bath, bathtub |
| `sink` | rakovina, umivalnik, раковина, умывальник, sink, washbasin |
| `toilet` | unitaz, унитаз, toilet, wc |
| `shower` | dush, душ, shower (a shower cabin, tray or panel) |
| `bidet` | bide, биде, bidet |

- A new `ROLE_GROUP` entry `plumbing` holds them. `fitsCatalogRoom` (from #207) offers them in `hammom` only, plus `sink` in `oshxona`.
- **The points a fixture needs** (`frontend/src/lib/plumbingPoints.ts`, `PLUMBING_NEEDS`). Heights are from the floor to the point's centre:

| Fixture | Drain | Cold water | Hot water |
|---|---|---|---|
| Bathtub | Ø50, 0.15 m | 0.70 m | 0.70 m |
| Sink | Ø50, 0.50 m | 0.55 m | 0.55 m |
| Toilet | Ø110, 0.20 m | 0.20 m | — |
| Shower | Ø50 floor trap, 0 m | 1.05 m | 1.05 m |
| Bidet | Ø50, 0.20 m | 0.25 m | 0.25 m |

### 2. The plumbing layer in room state

- The room state gets `plumbing: PlumbingPoint[]`:
  - `PlumbingPoint = { id, kind: 'drain' | 'cold' | 'hot', diameterMm?, wallId, positionMm, heightMm, fixtureId? }`;
  - `wallId` and `positionMm` work as they do for the electrical points: a wall, and how far along it;
  - a floor trap has `heightMm: 0`.
- A point with `fixtureId` belongs to that placed fixture: it is created when the fixture is placed, it follows when the fixture moves or turns (onto the wall behind the fixture), and it goes when the fixture is deleted. A point without `fixtureId` was added by hand and stays until removed.
- New store slice `plumbingSlice`, mirroring `electricalSlice`: `addPlumbing`, `movePlumbing`, `removePlumbing`, plus `syncFixturePoints(furniture)`, which recomputes the points owned by fixtures and leaves hand-added ones alone.
- Saved and loaded with the rest of the room state. A room saved before this (no `plumbing` key) loads with `[]`.
- **The riser** (where the pipes go to) is the flat's riser mark (`serviceFeatures`) when the room has one, otherwise the corner nearest the door. The pipe length of a point is the walk along the walls from the point to the riser, plus the drop or rise between their heights.

### 3. Studio: placement, the stage, 3D and the panel

**Placement.** The furniture layout (`freeFurnitureSpotMm` and `nextFurnitureSpot`) gets rules for the plumbing roles:

| Fixture | Where it goes |
|---|---|
| Bathtub | Long side along the longest free wall, ends against walls or a corner, not across the door |
| Shower | The free corner farthest from the door |
| Toilet | Back to a wall, as near the riser as it can stand, 0.6 m clear in front |
| Sink | Back to a wall, 0.7 m clear in front, clear of the door's swing |
| Bidet | Beside the toilet, 0.3 m between them |

- Fixtures keep clear of every piece already in the room. One that fits nowhere is still added, with the existing "no room" message.

**The "Santexnika" stage.**
- It comes after "Installation" and shows only in `hammom` and `oshxona` rooms (the room's type, or the guess from its name).
- The panel lists:
  - the room's fixtures;
  - the points, each with its kind, wall and height;
  - a **"+ Add point"** button: kind, wall, height.
- A one-line summary sits under the lists, for example "Drain: 4 points, ~5.2 m of pipe · Water: 6 points, ~9.8 m".

**3D.**
- Points show as small discs on the wall: drain grey, cold blue, hot red.
- A point can be dragged along its wall and up or down, the way an electrical socket is.
- A thin line along the walls shows each point's pipe run to the riser. It can be switched off. Once switched on, the runs stay drawn after the panel closes, until the box is unticked: on a phone the open panel covers part of the 3D (mobile QA 2026-11-09).

**Phone.** The arc menu gets a "Santexnika" category, with the fixtures and "add point".

**Furniture panel.** The desktop "3D models" panel filters by room type with `fitsCatalogRoom`, as the arc menu and the add sheet already do, and gets a **"Santexnika"** filter chip.

### 4. Estimate: the "Santexnika" section

A new estimate group `santexnika` (`backend/app/services/smeta.py`, `frontend/src/lib/smetaGroups.ts`). Plumbing fixtures move into it from "Furniture".

| Line | Worked out as | Price from |
|---|---|---|
| Each fixture | count × price | the shop's current price and name (as #194 does for furniture) |
| Drain pipe Ø50 | the Ø50 drain points' runs to the riser × 1.15 | the shop's `santexnika` product, else the average, marked approximate |
| Drain pipe Ø110 | the toilet's and floor traps' runs | the same |
| Water pipe (PPR Ø20) | the hot and cold points' runs × 1.15 | the same |
| Fittings | one set per point | the average, marked approximate |
| Work: connecting a point | number of points × norm | norm price |
| Work: fitting a fixture | each fixture × its norm (bathtub, toilet, sink, shower, bidet) | norm price |

- Each line shows its working under it, for example "4 points × 1.3 m average + 15% = 6.0 m". Text is in uz, ru and en, through the existing `smeta_text` / `smetaLineText` mechanism. The PDF picks it up.
- The norms (average pipe and fitting prices, the work per point and per fixture) live in one backend settings file, `backend/app/data/plumbing_norms.json`. Editing them from the admin panel is not in this version.
- A room with no `plumbing` key estimates as today, plus the fixtures under "Santexnika".

### 5. Mobile app

The studio and the estimate run inside the app's web view, so the plumbing layer reaches the app with no app release. A checklist for the mobile team is written in `docs/qa/` when the work ships.

## Delivery: three PRs, each useful alone

1. **Fixture roles, placement rules, the furniture panel's room filter and "Santexnika" chip.** The pile-up ends here.
2. **The plumbing layer:** store slice, fixture-owned points, 3D discs and pipe lines, the "Santexnika" stage, the arc menu category.
3. **The estimate's "Santexnika" section** and the norms file.

## Testing

- **Frontend:**
  - fixture roles in uz, ru and en;
  - the points each fixture needs;
  - placement (bathtub along a wall, shower in the corner away from the door, nothing overlapping);
  - fixture-owned points follow a moved fixture and go with a deleted one; hand-added points stay;
  - the stage shows only in a bathroom or kitchen;
  - the panel's room filter and chip.
- **Backend:**
  - pipe runs to the riser and to the door corner when there is no riser;
  - the 15% reserve, fittings per point, work norms;
  - shop price versus approximate;
  - a room with no `plumbing` key.
- **Prod:** "Hammom namunasi" after each PR, with a screenshot.

## Out of scope

- Waterproofing, wall and floor tiling, heated towel rails, ventilation (the next step).
- Editing the norms in the admin panel.
- The wizard's own faults found on the way are a separate fix:
  - it reopened an old draft without asking (a 6-wall room);
  - it offered 7.4 m walls for a bathroom;
  - it did not copy wall A to wall C in a rectangle.
