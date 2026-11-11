# The pipe scheme: trunks, branches and counted fittings

**Date:** 2026-11-11
**Status:** design agreed in brainstorm, awaiting review of this document
**Follows:** `2026-11-08-hammom-santexnika-design.md` (points, the riser, pipe runs) and `2026-11-10-sochiq-quritgich-ventilyatsiya-design.md` (towel rail points)

## Why

The estimate lays a pipe of its own from every plumbing point to the riser. No plumber does that: one trunk runs along the wall and each fixture joins it.

1. **Too much pipe.** The "Hammom" room (2.5 × 2.0 m, seven water points) is priced with 23.9 m of water pipe. A trunk and its branches need about half.
2. **Fittings are a guess.** One line, "one set per point" at 35 000 UZS, whatever the layout.
3. **The 3D lines say nothing.** With "Show pipe runs" on, every point draws its own line to the riser at floor level, one on top of another.

**Success means:**

- A room's pipes form a scheme: one trunk per kind of pipe along the walls, a vertical branch to each point.
- The estimate's pipe lengths come from that scheme, and its fittings are counted from it, by type.
- The 3D lines and the panel's summary show the same scheme the estimate prices.

## Decisions (from the brainstorm)

| Question | Decision |
|---|---|
| What "pipe architecture" covers now | **The right scheme and its count.** Real pipe shapes in 3D and a printable sheet for the plumber are later steps. |
| How water is distributed | **In series**: one trunk, each fixture on a tee. A manifold layout is left for later. |
| How fittings are priced | **Counted by type**, each type a line of its own at a norm price. The "set per point" line goes. |
| Is the scheme saved | **No.** The studio and the estimate each work it out from the points and the riser, by one rule pinned by a shared fixture file. |

## Design

### 1. The scheme

**Input.** The room's walls (a closed loop, walked as `lib/plumbingRuns` `wallWalk` walks it), the riser (`plumbingRiser`, else `riser_spot`), and the points: saved or derived fixture points, hand-added points and towel rail points. Each point has a kind (`drain`, `cold`, `hot`), a wall, a position along it and a height.

**Pipe kinds.** Four trunks are worked out separately: cold water, hot water, drain Ø50, drain Ø110.

**Where a trunk runs.** A trunk follows the walls and joins the riser to every point of its kind.

- The loop is cut where a trunk may not pass. It does not pass a door at wall height, so each door is a cut.
- With no door, the loop is cut at the largest gap between neighbouring nodes (the riser and the points): the shortest trunk that still reaches them all.
- With one door, the walls are a line from one side of the door to the other, and the trunk spans from the first node to the last.
- With two or more doors, the largest gap that holds a door is the cut. The trunk crosses each other door under the floor; that length is counted like any other.
- A window does not cut the loop: pipes run below it.

**Heights.**

| Pipe | Trunk height above the floor | Branch to a point |
|---|---|---|
| Cold and hot water | 200 mm | vertical, from the trunk to the point's height: `abs(height − 200)` |
| Drain | 0 (floor level) | vertical, from the point's height down: `height` |

**Drain diameters.**

- The way from a toilet's drain point (`diameterMm: 110`) to the riser is Ø110. With several toilets it is the union of their ways.
- Everything else on the drain trunk is Ø50.
- A Ø50 point whose place lies on the Ø110 way joins it there; that stretch is counted as Ø110 only.
- With no Ø110 point, the whole drain trunk is Ø50.

**Lengths.** For each kind: `trunk + branches`, then × 1.15 reserve (as today). A kind with no points has no trunk.

**Bad data.** A point on a wall the room does not have is left out. A position past its wall's end is clamped into the wall. A negative height is read as 0. No length or count is ever negative.

### 2. Fittings

Every point joins its trunk by a vertical branch. From that:

**Water** (counted for cold and hot separately, then added):

| Fitting | Count |
|---|---|
| Tee Ø20 | one at every point that is not the last on its arm of the trunk; one more at the riser when the trunk leaves it both ways |
| Elbow Ø20 | one at every room corner the trunk passes; one at each end of the trunk (the last point takes an elbow, not a tee) |
| Wall outlet Ø20 | one per water point |
| Ball valve Ø20 | one per water trunk, at the riser (so one for cold, one for hot) |

**Drain:**

| Fitting | Count |
|---|---|
| Tee Ø50 | one at every Ø50 point on the Ø50 trunk that is not the last on its arm |
| Elbow Ø50 | one at every room corner the Ø50 trunk passes; one at each end of it |
| Tee Ø110/50 | one wherever a Ø50 point or the Ø50 trunk joins the Ø110 way |
| Elbow Ø110 | one at each toilet's drain point; one at every room corner the Ø110 way passes |

An arm of a trunk is the part that leaves the riser one way. Two points at the same place are two branches: each is counted.

### 3. Estimate lines (category `santexnika`)

**Changed:**

| Line | Now |
|---|---|
| `Suv quvuri PPR Ø20`, `Kanalizatsiya quvuri Ø50`, `Kanalizatsiya quvuri Ø110` | Length from the scheme. Formula: `Magistral 6.10 m + tik bo'laklar 4.35 m = 10.45 m × 1.15 = 12.02 m`. The shop pipe product, found by name, prices it as today. |
| `Fitinglar` (one set per point) | **Removed.** |

**New**, each by the piece, at a norm price, marked approximate; a line whose count is 0 is not listed:

| Line | Starting norm, UZS |
|---|---|
| `PPR troynik Ø20` | 3 000 |
| `PPR burchak Ø20` | 2 500 |
| `Suv rozetkasi Ø20` | 12 000 |
| `Sharli kran Ø20` | 35 000 |
| `Kanalizatsiya troynigi Ø50` | 9 000 |
| `Kanalizatsiya burchagi Ø50` | 6 000 |
| `Kanalizatsiya troynigi Ø110/50` | 22 000 |
| `Kanalizatsiya burchagi Ø110` | 18 000 |

- These prices are estimates of mine, to be corrected by the owner. They live in `backend/app/data/plumbing_norms.json`, beside the pipe prices; `fitting_set_uzs` goes.
- Each formula says where the count comes from, for example `5 tarmoq + 1 stoyak = 6 dona` or `2 xona burchagi + 2 magistral uchi = 4 dona`.

**Unchanged:** the fixtures, `Ish: nuqtani ulash` (per point), the fixture fitting work, the towel rail lines.

**Text.** Every new label and formula word (magistral, tik bo'laklar, tarmoq, stoyak, xona burchagi, magistral uchi) in Russian and English on the page (`smetaLineText.ts`) and in the PDF (`smeta_text.py`, `smeta_locale.json`).

### 4. The studio

**"Show pipe runs"** draws the scheme instead of a line per point:

- One line per trunk along the walls: water at 200 mm above the floor, drain at floor level. The cold and hot trunks are drawn 50 mm apart in height so they do not lie on one another.
- A vertical line from the trunk to each point.
- Colours as today: grey drain, blue cold, red hot. The Ø110 way is drawn thicker than Ø50.

**The panel's summary** ("Kanalizatsiya: N nuqta, ~X m · Suv: M nuqta, ~Y m") takes its metres from the scheme, so it agrees with the estimate.

Nothing new is saved and there is no new control.

### 5. Delivery and tests

**Three pull requests**, stacked and folded into one before the merge to master, so there is one deploy:

| PR | Contents |
|---|---|
| 1 | The scheme rule, on the backend and the frontend alike: trunks, branches, diameters, fitting counts, and the segments to draw. Used nowhere yet. |
| 2 | The estimate: pipe lines from the scheme, the eight fitting lines in place of the set, the norms, the text. |
| 3 | The studio: the 3D lines and the panel summary from the scheme; a checklist for the mobile app. |

**Tests** (each written first and seen to fail):

- **Trunk:** a room with one door; with none (the largest gap is the cut); with two; the riser in the middle of a wall (two arms); all points to one side.
- **Branches:** a point at the trunk's height (0 m); a shower outlet (0.85 m); a drain point (its height).
- **Diameters:** the toilet beside the riser; farthest from it (the whole way Ø110); in the middle (Ø50 beyond it); no toilet.
- **Fittings:** one point (no tee, one elbow); a room corner passed; two arms (a tee at the riser); a Ø50 point joining the Ø110 way; two points at one place.
- **Room shapes:** an A–D room and a scanned polygon room.
- **Both sides agree:** the backend and the frontend give the same scheme for every case, through one shared fixture file.
- **Estimate:** the lines and formulas; a zero count is not listed; towel rail points and hand-added points; saved and derived points.
- **Old rooms:** a room with no plumbing is unchanged; an old room with points is priced without error.
- **Text:** every new label and formula word in Russian and English, on the page and in the PDF.
- **Bad data:** a point on a missing wall, a position past the wall's end, a negative height: no error, no negative length.

**After this ships:**

- Every room with plumbing gets a smaller "Santexnika" total: less pipe, and counted fittings in place of the sets. For "Hammom", about 250–300 thousand UZS less (a rough figure; the exact one is reported from production before and after the deploy).
- The look of the 3D lines is checked by the owner or the mobile team from the checklist; here it is tested as geometry only.
- No production data is changed.

## Out of scope

- Real pipe shapes in 3D (diameter, in or on the wall) and a printable sheet for the plumber.
- A manifold layout, and choosing between the two.
- Checking the drain's slope (whether a far shower can fall to the riser).
- Chasing the wall, pipe insulation, clips.
- Couplings and adapters, a drain inspection hatch, filters, pressure reducers, meters.
- A hot water circulation line.
- Drawing or editing the trunk by hand.
- Tying shop products to the fitting lines.
- Editing the norms in the admin panel.
