# Heated towel rail and extractor fan

**Date:** 2026-11-10
**Status:** design agreed in brainstorm, awaiting review of this document
**Follows:** `2026-11-08-hammom-santexnika-design.md` (plumbing points, the riser, pipe runs) and `2026-11-10-plitka-gidroizolyatsiya-design.md` (its "Out of scope": heated towel rails and ventilation)

## Why

A bathroom's estimate still misses two things nearly every bathroom has:

1. **A heated towel rail.** The code does not know the fixture. The furniture catalog (the 3D models) has none; the shop has two as plain materials. It cannot be placed in the studio and nothing of it is in the estimate.
2. **Ventilation.** Nothing in the code or the catalog knows a bathroom has an extractor fan.

**Success means:**

- A bathroom's estimate lists an extractor fan, its cable and its fitting work, unless the user turned it off.
- A user can add a towel rail to a bathroom wall, see it in 3D and slide it along the wall.
- A towel rail's estimate has the rail, the pipe to the riser, the fittings, the connection work and the fitting work, each line showing its working.

## Decisions (from the brainstorm)

| Question | Decision |
|---|---|
| Which kind of towel rail | **Water-heated**, fed from the hot water riser. The electric kind is left for later. |
| What ventilation covers | **The extractor fan only**: the fan, a cable, the work. The shaft is taken to be in the bathroom wall; no duct. |
| When the fan is added | **Automatically in every bathroom**, with a switch to turn it off. |
| How a towel rail gets into the room | **From the plumbing panel, hung on a wall.** Not a furniture catalog item, and no 3D model file: a simple shape is drawn in code. |
| Prices | As for tile work and plumbing: the shop product tagged with a new `smeta_key`, else a norm price, marked approximate. Work is always a norm price. |
| Which rooms | A bathroom only: `room_type == "hammom"`, or, with no type set, a name `guess_room_type` reads as one. |

## Design

### 1. The towel rail

**Data.** The room state gains a list beside `plumbing` and `plumbingRiser`:

```
towelRails: [{ id: string, wallId: string, positionMm: number, heightMm: number }]
```

- `positionMm` is the rail's centre along the wall, measured as a plumbing point's is (`lib/plumbingRuns` `wallWalk`).
- `heightMm` is its bottom edge above the floor.
- The rail's size is fixed: 500 mm wide, 800 mm high.
- It is not in the furniture list: it is not a catalog item.
- A room saved before this has no list and reads as it does today.
- `towelRails` joins the keys the autosave and the room copy carry (`ROOM_CONTENT_KEYS`).

**Its points.** Each rail has two hot water points, Ø20: the feed at its bottom left corner and the return at its bottom right. They are **derived from the rail, never saved**: the studio and the estimate each compute them from `towelRails`, by one rule kept the same on both sides through a shared fixture file, as fixture points are. They cannot be dragged or deleted on their own; they move and go with the rail.

**Adding one.** The plumbing panel gains a button, "Sochiq quritgich qo'shish":

- The rail goes on the riser's wall, its centre 600 mm from the riser, its bottom edge 1000 mm above the floor.
- If that place is taken by a door or a window, or runs past the wall's end, it goes to the nearest free place on that wall; if the wall has none, to the nearest free place on the next wall round the room.
- The panel lists the rails, each with its wall and a delete button.
- A room may have more than one.

**Moving it.** A rail slides along its wall by drag, as a hand-added point does. It cannot be slid over a door or a window, or past the wall's ends. Its height is not changed by drag.

**In 3D.** A ladder against the wall: two uprights and six rungs, chrome. With "Show pipe runs" on, the runs from its two points to the riser are drawn like any other.

**Undo.** Adding, a whole drag and deleting are one undo step each, as for plumbing points.

**Edge cases:**

- A room with no walls in its geometry: the button does nothing and the panel says there is no room to hang it in, as adding a point does.
- When the room's shape changes and the rail's wall is gone, the rail goes too; when the wall is only shorter, the rail is moved back inside it. This is the rule points follow.
- A rail may overlap furniture; nothing checks it.

### 2. The extractor fan

**When.** The room is a bathroom. It does not depend on the stage of the floor or the walls.

**Turning it off.** The plumbing panel gains a switch, "Tortuvchi ventilyator", on by default. Off, `designState.ventFan` is saved as `false` and the estimate has no fan lines. Any other value, or no field, means on: every bathroom saved so far gets the fan.

**In the studio.** Nothing is drawn.

### 3. Estimate lines

**Towel rail** (category `santexnika`, the "Santexnika" group):

| Line | Quantity | Price |
|---|---|---|
| `Sochiq quritgich` or `Sochiq quritgich: <product>` | one per rail | the cheapest shop product tagged `sochiq_quritgich`, else the norm, approximate |
| `Suv quvuri PPR Ø20` | joins the existing line: each point's run to the riser, × 1.15 | as today |
| `Fitinglar` | joins the existing line: one set per point, so two per rail | as today |
| `Ish: nuqtani ulash` | joins the existing line: two points per rail | as today |
| `Ish: sochiq quritgichni o'rnatish` | one per rail | norm |

The rail's points take part in the plumbing lines whether the room's `plumbing` is saved or derived.

**Extractor fan** (a new category `ventilyatsiya`, shown in the "Elektr va yoritish" group):

| Line | Quantity | Price |
|---|---|---|
| `Tortuvchi ventilyator` or `Tortuvchi ventilyator: <product>` | 1 | the cheapest shop product tagged `ventilyator`, else the norm, approximate |
| `Elektr kabel (ventilyator)` | 3 m, fixed | the shop's cable price, else the cable norm |
| `Ish: ventilyatorni o'rnatish` | 1 | norm |

- The category is its own, not `elektr`: an `elektr` line switches on the "confirm the wiring plan" notice (`has_electrical`), which a fan must not do.
- The cable is a fixed 3 m: the fan is wired to the nearest light circuit and nothing in the room says how far that is. The formula says so.

**Where prices come from:**

- Two new `smeta_key` values (`backend/app/services/smeta_keys.py`): `sochiq_quritgich` and `ventilyator`, both sold by the piece. They join the admin panel's key list (`frontend/src/lib/api/adminMaterials.ts`).
- Norms live in a new `backend/app/data/bathroom_extras_norms.json`:

| Norm | Starting value, UZS |
|---|---|
| Towel rail, each | 650 000 |
| Work: fitting a towel rail | 200 000 |
| Extractor fan, each | 180 000 |
| Work: fitting an extractor fan | 100 000 |

These prices are estimates of mine, to be corrected by the owner; a line priced from one is marked approximate with a warning.

**Other rules:**

- In the "repair only" view (no furniture) both sets of lines stay in the total, as plumbing does.
- Every new label, unit, formula word and warning is translated to Russian and English on the page (`smetaLineText.ts`) and in the PDF (`smeta_text.py`, `smeta_locale.json`).

### 4. Delivery and tests

**Three pull requests, each working on its own**, stacked and folded into one before the merge to master, so there is one deploy:

| PR | Contents |
|---|---|
| 1 | The extractor fan: its lines, the `ventilyator` key, the norms file, the panel switch, the text. |
| 2 | The towel rail in the estimate: the `towelRails` data, its points (backend and frontend alike), its lines, the `sochiq_quritgich` key. |
| 3 | The towel rail in the studio: the panel button, the placing rule, the 3D ladder, drag, undo, and a checklist for the mobile app. |

**Tests** (each written first and seen to fail):

- **Fan:** in a bathroom; not in another room; not with `ventFan: false`; in an old room with no field; with and without a tagged shop product; it does not switch on the wiring notice.
- **Rail points:** two hot water points in the right places; the backend and the frontend agree, through a shared fixture file.
- **Rail in the estimate:** the pipe run reaches the riser; fittings and connection work count two points; two rails count twice; with and without a tagged shop product; a room whose `plumbing` is saved and one whose points are derived.
- **Placing:** free room beside the riser; a door in the way; a short wall; a room with no walls.
- **Room shapes:** an A–D room and a scanned polygon room with walls `"0".."n"`.
- **Old rooms:** a room with no `towelRails` opens and its estimate is unchanged but for the fan.
- **Studio:** add, drag, delete; one undo step each; the rail goes when its wall goes; it is there after save and reload.
- **Text:** every new label, unit and warning in Russian and English, on the page and in the PDF.

**After this ships:**

- Every bathroom's estimate grows by the fan lines, about 300–350 thousand UZS at the norm prices. This is intended.
- The 3D ladder and the drag are checked by tests only; how they look is confirmed by the owner or the mobile team from the checklist.
- No production data is changed. Tagging the shop's two towel rails with `sochiq_quritgich` is the owner's step in the admin panel.

## Out of scope

- An electric towel rail.
- Choosing the rail's size, or a particular shop product for it.
- A duct to the shaft, a grille, and picking the fan by the room's volume.
- Drawing the fan in 3D.
- Valves and angle connectors for the rail as lines of their own; they are taken to be in the "Fitinglar" set.
- Checking a rail against furniture.
- A towel rail as a furniture catalog item with a 3D model.
- Editing the norms in the admin panel.
