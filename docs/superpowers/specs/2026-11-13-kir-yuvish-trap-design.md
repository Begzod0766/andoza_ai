# A washing machine, and a floor drain for a shower with no tray

**Date:** 2026-11-13
**Status:** written from the conversation, awaiting the owner's approval
**Follows:** `2026-11-10-sochiq-quritgich-ventilyatsiya-design.md` (the towel rail: drawn in code, slid along a wall, points worked out from it) and the fixture parts of #255

## Why

- **Washing machine.** It needs a cold water tap and a drain on the wall, and a plumber to connect it. The estimate cannot see it today. It is not a plumbing fixture, and the catalog has no model of one, so it cannot even be put in the room.
- **Floor drain.** A shower with no tray drains through a floor drain. The estimate prices a tray trap for every shower.

**Success means:**
- A washing machine can be put in a bathroom or a kitchen and slid along a wall.
- Its points join the pipe scheme, and its connection is priced.
- A shower with no tray is priced with a floor drain instead of a tray trap.

## Approaches (washing machine)

| | Approach | Trade-off |
|---|---|---|
| **A, picked** | A panel button. A plain white box drawn in code (600 × 600 × 850 mm), slid along a wall like the towel rail; its points are worked out from it | No model needed; ships now. Plain to look at |
| B | Points only, from the panel; nothing drawn | Fastest, but the machine is not seen |
| C | A real catalog item with a 3D model, placed like other fixtures | Best looking; needs models (shops or Tripo); much larger |

The owner picked **A**.

## Design

### 1. The washing machine

**State.** `washers: { id, wallId, positionMm }[]` in the room state, as `towelRails` are. `positionMm` is the machine's centre along the wall walk. Saved with the room; an old room has none.

**Points.** Worked out from the machine, never saved, on both sides alike (frontend `lib/washer.ts`, backend `services/washer.py`), pinned by one shared fixture file:

| Point | Along the wall | Height |
|---|---|---|
| Cold water Ø20 | centre + 150 mm | 900 mm |
| Drain Ø50 | centre − 150 mm | 600 mm |

They are listed in the panel with "(machine's)", like a rail's points, and join the pipe scheme and its fittings.

**Placing.** "Add a washing machine" in the Santexnika panel, in a bathroom or a kitchen.
- Against the wall nearest the riser, at the nearest place where its 600 mm width fits.
- It stays clear of doors, windows, towel rails, other machines and the wall's ends (as the towel rail's `freeSpans`).
- At the place found, nothing in the furniture stands in its 600 × 600 mm floor box; else the next place is tried.
- With no place left, the panel says there is no room.

**Dragging.** In the Santexnika stage it slides along its wall by finger. It stays off doors, windows and the wall's ends; it does not check furniture while dragged. A drag is one undo step. It does not jump to another wall.

**3D.** A white box, 600 × 600 × 850 mm, its back 20 mm off the wall, with a darker round door on the front. Hidden with its wall when the camera looks through that wall.

**Room changes.** A wall made shorter pulls the machine back inside. A door or window put on it moves it to the nearest free place. A new room shape without its wall drops it.

**Panel.** A "Washing machine" block: the button, a row per machine ("wall 2"), and "Remove".

### 2. Its estimate lines (category `santexnika`)

The machine itself is not priced: it is an appliance the owner buys, not part of the work.

| Line | Count | Price |
|---|---|---|
| `Kir yuvish mashinasi krani` (a tap with a filter) | 1 per machine | shop key `kran_kir`, else norm 60 000 |
| `Kir yuvish mashinasi sifoni` (a trap with a hose outlet) | 1 per machine | shop key `sifon_kir`, else norm 70 000 |
| `Ish: kir yuvish mashinasini ulash` | 1 per machine | 150 000 |

Its two points are in the pipe lengths, the fittings and "Ish: nuqtani ulash", as a rail's are.

### 3. The floor drain

**Switch.** "Shower with no tray (floor drain)" in the Santexnika panel: `designState.floorDrain`, counted only when exactly true. Shown only when the room has a shower.

**Estimate.** With the switch on and at least one shower, each shower takes, in place of `Dush poddoni sifoni`:

| Line | Price |
|---|---|
| `Pol trapi` | shop key `trap_pol`, else norm 450 000. Shops sell these as materials, e.g. «Трап кафель 300 мм» |
| `Ish: trap o'rnatish` | 200 000 |

The shower's mixer is unchanged. The drain point stays as it is (at the floor).

### 4. Shared

- All norms in `backend/app/data/plumbing_norms.json`. **They are estimates of mine, to be corrected by the owner.**
- Shop keys `kran_kir`, `sifon_kir`, `trap_pol` are sold by the piece and appear in the admin key list.
- Every new label and panel word in Russian and English, on the page and in the PDF.

### 5. Delivery and tests

**One pull request,** with a mobile checklist.

**Tests** (each written first and seen failing):
- Points from a machine: on both sides, from one shared fixture file. A machine on a wall the room lacks gives none.
- Placing: by the riser; clear of doors, rails and other machines; furniture in the box moves it on; no room says so.
- Dragging: stays off doors and the wall's ends; one undo step.
- Room changes: shorter wall, a new door, a shape without its wall.
- Estimate: the two parts and the work per machine; its points in the pipes; no machine, no lines.
- Floor drain: off by default; on with a shower swaps the tray trap for the drain and its work; on with no shower adds nothing.
- Old rooms: no `washers` key, no change.
- Text: every new label in ru/en, page and PDF.

## Out of scope

- A real washing machine model, or picking its size.
- A dishwasher.
- Checking the machine against furniture while it is dragged.
- An electric socket line for the machine.
- Showing the floor drain in 3D, or sloping the floor to it.
