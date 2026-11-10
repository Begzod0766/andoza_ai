# Tile work and waterproofing

**Date:** 2026-11-10
**Status:** design agreed in brainstorm, awaiting review of this document
**Follows:** `2026-11-08-hammom-santexnika-design.md` (its "Out of scope": waterproofing, wall and floor tiling)

## Why

A bathroom's estimate is still far from what the work costs:

1. **Wall tile is priced as a photo wallpaper.** A tiled wall is a `texture` covering with `finish: 'tile'`. The estimate treats every `texture` as a custom print and asks the AI for a price. No tile, by the square metre, is listed.
2. **Tile has no adhesive, grout or laying work.** A tiled floor lists the tile and the skirting only. The same is true in any room.
3. **Wall tile always runs to the ceiling.** Many bathrooms are tiled to 1.5–2.1 m and painted above. The studio cannot show that and the estimate cannot price it.
4. **No waterproofing at all.** Nothing in the code knows a bathroom floor is sealed.

**Success means:**

- A room with tile, on the floor or on walls, has an estimate with the tile, the adhesive, the grout and the laying work, each line showing its working.
- A wall can be tiled to a chosen height with paint above it; the 3D view shows it and the estimate splits the wall between tile and paint.
- A bathroom's estimate has waterproofing: mastic, tape and work, for the floor, the foot of the walls and the walls around the bathtub and shower.

## Decisions (from the brainstorm)

| Question | Decision |
|---|---|
| How high wall tile goes | **The user chooses**: to the ceiling, or to a height, with paint above. |
| Waterproofing | **Automatic in a bathroom**, by a fixed rule. Nothing to choose. |
| Prices | **Shop products and norms**, as for floor tile and plumbing. Wall tile at the shop's median tile price, marked approximate. Adhesive, grout, mastic and tape from the shop product tagged with a new `smeta_key`; without one, a norm price, marked approximate. Work from norms. |
| Which rooms | **Tile lines in any room with tile.** Waterproofing in a bathroom only. Tile height can be chosen in any room. A kitchen backsplash is not part of this. |
| How the height is stored | **Two optional fields on the existing tile covering.** Not a new covering kind, and not a separate tile layer. |

## Design

### 1. Wall tile height

**Data.** The wall covering `{ kind: 'texture', finish: 'tile', … }` (`frontend/src/store/types.ts`) gains two optional fields:

- `tileHeightMm?: number`: how high the tile goes, from the floor. Absent, or not below the ceiling height, means to the ceiling. Every room saved so far therefore reads as it does today.
- `aboveColor?: string`: the paint above the tile. Default `#FFFFFF`.

They live on the covering, so they apply to one wall or to `ALL`, like the covering itself. They are saved, undone and autosaved with `designState`, with no new store state.

**Choosing it.** When the wall in the wall panel (`WallSection`) carries tile, two controls appear:

- **Height:** chips "To the ceiling", "1.5 m", "1.8 m", "2.1 m", and a field for a height in centimetres.
- **Above:** the paint palette the wall's paint picker uses. Shown only while the height is below the ceiling.

Picking the tile itself (size and face, from the ring and the corner menu) is unchanged. A newly placed tile goes to the ceiling.

**In 3D.** A wall whose tile stops below the ceiling is drawn in two bands: tile below, paint in `aboveColor` above. Doors and windows cut both bands as they cut the wall today. No border or trim is drawn at the top of the tile.

**Edge cases:**

- A height under 300 mm is taken as 300 mm.
- If the ceiling is later lowered to or below the tile height, the tile is drawn, and priced, to the ceiling. The stored height is left as it is.
- The AI designer and the ready-made styles keep placing tile to the ceiling.

### 2. Waterproofing

**When.** The room is a bathroom: `room.room_type == "hammom"`, or, with no type set, a name `guess_room_type` reads as one (`backend/app/services/room_type.py`). It does not depend on tile being chosen.

**Which surfaces:**

| Surface | Rule |
|---|---|
| Floor | The floor covering area (`_floor_covering_area_m2`: the floor less riser boxes). |
| Foot of the walls | 0.2 m high along every wall, less the door widths. |
| Wet zone | On each wall a bathtub or shower touches: the length of the fixture's side against that wall plus 0.3 m at each end, from the floor to 1.8 m. |

- A fixture **touches** a wall when its edge is within 0.15 m of it. A shower in a corner touches two walls. A bathtub touches the wall along its back and any wall its ends reach.
- A wet-zone strip never runs past the ends of its wall. Where it overlaps the foot-of-the-wall band, that part is counted once. Two strips that overlap on one wall are counted once.
- A door or window inside a wet-zone strip is not subtracted: the strip is a few square metres and the reveal is sealed too.
- A sink, toilet or bidet gives no wet zone. A bathroom with neither bathtub nor shower has the floor and the foot of the walls only.
- The fixtures are the placed furniture whose role is `bathtub` or `shower` (`infer_role`), with the footprint the plumbing code already reads. The walls are the room's walls as `app/services/plumbing.py` `_room_walls` has them, so A–D rooms and scanned polygon rooms are both covered.

**Materials:**

| Line | Quantity |
|---|---|
| Waterproofing mastic | 1.5 kg per m² (two coats), over the whole area |
| Waterproofing tape | The floor-to-wall joint (perimeter less doors), plus 1.8 m for each wall corner inside a wet zone |
| Work | The whole area, per m² |

**In the studio.** Nothing is drawn: waterproofing lies under the tile. It appears in the estimate only, with its working, for example `Pol 5.0 m² + devor tagi 1.7 m² + ho'l zona 6.1 m² = 12.8 m²`.

### 3. Estimate lines

**Wall tile** (replaces the AI-priced `texture` line for a covering with `finish: 'tile'`):

- **Area:** each tiled wall from the floor to its tile height, less the part of each door and window that falls inside that band.
- **Quantity:** area × `TILE_WASTE` (1.10, the floor tile's).
- **Price:** the shop's median tile (`catalog["finish:plitka"]`), marked approximate with `FINISH_STAND_IN_NOTE`, as a floor tile nobody picked a product for. With no shop tile, a norm price, marked approximate.
- **Label:** `Devor plitkasi` or `Devor plitkasi: <product>`; category `plitka_devor`, in the "Devor pardozi" group.
- **Paint above:** the wall's area above the tile joins the paint lines, as a painted wall of colour `aboveColor`.

**Floor tile:** unchanged (m² × 1.10, and the skirting).

**New lines, in any room with tile** (wall and floor tile area together, before waste):

| Line | Quantity | Sold as |
|---|---|---|
| Plitka yelimi | 5 kg per m² | 25 kg bags, rounded up |
| Zatirka | 0.4 kg per m² | 2 kg packs, rounded up |
| Ish: pol plitkasini terish | floor tile area | m² |
| Ish: devor plitkasini terish | wall tile area | m² |

**Waterproofing lines, in a bathroom** (section 2): `Gidroizolyatsiya mastikasi` (kg), `Gidroizolyatsiya lentasi` (m), `Ish: gidroizolyatsiya` (m²).

**Where prices come from:**

- Four new `smeta_key` values (`backend/app/services/smeta_keys.py`): `plitka_yelimi` (pack in kg), `zatirka` (kg), `gidro_mastika` (kg), `gidro_lenta` (m). A shop product tagged with one prices its line, by the pack it is sold in, and names its shop. The cheapest wins, as for `suvoq` and `grunt` (`pick_cheapest`).
- Without a tagged product: the norm price, and the line is marked approximate with a warning.
- Work is always a norm price.
- Norms live in `backend/app/data/tile_norms.json` (as `plumbing_norms.json` does): the consumption rates above and the prices below.

| Norm | Starting value, UZS |
|---|---|
| Wall tile, per m² (no shop tile) | 120 000 |
| Tile adhesive, 25 kg bag | 45 000 |
| Grout, 2 kg pack | 35 000 |
| Waterproofing mastic, per kg | 28 000 |
| Waterproofing tape, per m | 7 000 |
| Work: floor tile, per m² | 80 000 |
| Work: wall tile, per m² | 100 000 |
| Work: waterproofing, per m² | 25 000 |

These prices are estimates of mine, to be corrected by the owner; the lines that use them are marked approximate.

**Grouping.** A new estimate group **"Plitka ishlari"** (`plitka_ish`), after "Pol va plintus", holds the adhesive, grout, laying work and waterproofing. Backend `smeta_groups.py` and frontend `smetaGroups.ts` gain it together, with a colour and an icon. Wall tile stays under "Devor pardozi" and floor tile under "Pol va plintus".

**Text.** Every new label, unit, formula word and warning is translated to Russian and English on the page (`smetaLineText.ts`) and in the PDF (`smeta_text.py`, `smeta_locale.json`).

### 4. Delivery and tests

**Three pull requests, each working on its own:**

| PR | Contents |
|---|---|
| 1 | Tile work in the estimate: wall tile priced as tile (to the ceiling), adhesive, grout, laying work, the "Plitka ishlari" group, the four `smeta_key` values, `tile_norms.json`. |
| 2 | Wall tile height: the two covering fields, the panel controls, the two bands in 3D, the tile and paint areas in the estimate. |
| 3 | Waterproofing: the area rule, mastic, tape, work, and a checklist for the mobile app. |

**Tests** (each written first and seen to fail):

- **Tile band area:** a door wholly inside the band, a window partly inside it, a window wholly above it, a height above the ceiling.
- **Wet zone:** a bathtub along a wall, a shower in a corner (two walls), a fixture touching no wall, a room with neither, the overlap with the foot-of-the-wall band counted once, a strip clipped at the wall's end.
- **Room shapes:** an A–D room and a scanned polygon room with walls `"0".."n"`.
- **Prices:** a tagged shop product present and absent; rounding up to whole bags and packs.
- **Old rooms:** a tile covering with no height reads as to the ceiling; a room without tile gets none of the new lines; a room that is not a bathroom gets no waterproofing.
- **Text:** every new label, unit and warning in Russian and English, on the page and in the PDF.
- **Studio:** the height control, "Above" shown only below the ceiling, undo.

## Out of scope

- A kitchen backsplash (a tile strip that does not start at the floor).
- Picking a shop's own tile product for a wall, with its picture and exact price.
- Wall preparation under tile: plaster, primer and putty are still counted for the whole wall, though tile needs no putty under it.
- Grout consumption by tile size and joint width; one average rate is used.
- Tile spacers, corner profiles, a border at the top of the tile.
- Drawing waterproofing in 3D.
- Heated towel rails and ventilation (the next step after this).
- Editing the norms in the admin panel.
