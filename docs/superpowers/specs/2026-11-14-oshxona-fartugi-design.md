# Oshxona fartugi (kitchen backsplash) — design

Date: 2026-11-14. Approach approved by the user in chat ("ha, 1-yo'l ma'qul, o'zing bajar"); material
choice "plitka yoki skinali" is theirs.

## Intent and why
A kitchen renovation almost always gets a backsplash: the strip of wall between the worktop (~85 cm)
and the wall cabinets (~145 cm), usually only as long as the worktop. Today the studio can tile a
wall only from the floor up (`tileHeightMm`, spec 2026-11-10, which set the backsplash aside), and a
kitchen has no worktop object to hang one on. The user wants to place a backsplash, see it in 3D,
and get it in the estimate, in tile or in skinali (a glass panel, very common in Tashkent).

## Goals
- Place one or more backsplashes on a kitchen's walls: wall, where it starts, how long, from what
  height to what height, tile or skinali, and a colour.
- See each as a panel on its wall in 3D, cut around doors and windows.
- Price it: tile with its adhesive, grout and laying work; skinali by the m² with its fitting work.

## Non-goals
- Dragging a backsplash in 3D (it is set in the panel).
- Photo-printed skinali, a picked tile product with its picture, borders or trims.
- Placing it from the kitchen furniture automatically (there is no worktop object).
- The AI designer and the ready-made styles do not add one.

## Anti-goals
- A room saved before this must read and price exactly as it does today.
- The wall's own covering (paint, wallpaper, tile) must not change when a backsplash is added.

## Approaches (picked: 1)
1. **A backsplash is an object of its own (chosen):** a list in `designState`, each drawn as a thin
   panel in front of its wall. Works over any wall covering, any length; undo and autosave come with
   `designState`.
2. A band of the wall covering (extend `tileHeightMm` to a from–to band): skinali is not a
   covering, and a part-length band means cutting the wall's pieces vertically too.
3. A per-wall tick, full wall length: simplest, but a backsplash runs the worktop's length, so the
   estimate would overcharge.

## Design

### Data
`DesignState.backsplashes?: Backsplash[]` (absent = none; every old room reads as today):

```ts
interface Backsplash {
  id: string
  wallId: string
  material: 'tile' | 'skinali'
  startMm: number    // from the wall's own start, the same frame as a door's `position`
  lengthMm: number
  bottomMm: number   // above the floor
  topMm: number
  color: string      // '#RRGGBB'
}
```

- New: `startMm` 0, `lengthMm` min(wall length, 3000), `bottomMm` 850, `topMm` 1450, material
  `tile`, colour `#F2EFE9` (tile) / `#FFFFFF` (skinali).
- Sanity (frontend on load and backend on read, the same rule): a backsplash is dropped unless its
  id and wallId are non-empty strings, material is one of the two, and the four numbers are finite.
  It is then clamped: start to [0, wall length]; length so it ends at the wall's end at most and is
  at least 100 mm; bottom ≥ 0; top ≤ the ceiling; top − bottom ≥ 100 mm (else dropped). One on a
  wall the room no longer has is dropped (not priced, not drawn), but kept in the saved list.
- Saved, undone and autosaved with `designState` (`setDesignState({ backsplashes })`); no new slice.

### Where it is set
In the wall stage's panel (`WallSection`), only when the room is a kitchen (`roomType` `oshxona`,
or the studio's existing kitchen test), a "Fartuk" block:
- a "Fartuk qo'shish" button: adds one on the wall currently picked in the wall chips (wall A when
  "all walls" is picked);
- one row per backsplash: the wall (chips of the room's walls), start and length in cm, height
  chips "85–145 sm" (default), "90–150 sm", "85–160 sm" plus two cm fields, material Plitka /
  Skinali, a colour (the paint palette's swatches), and remove.

### In 3D
- Each backsplash is drawn as a box `6 mm` thick standing `3 mm` off its wall (so it never
  z-fights with the wall), on the room side.
- It is the rectangle [start, start + length] × [bottom, top] in the wall's plane, less every door
  and window on that wall (their resolved positions, as `lib/wallPositions` draws them, with their
  sill heights); the remainder is cut into rectangles and each is drawn. Pieces under 10 mm a side
  are left out.
- Tile: matte, with a grout grid (10×10 cm tiles, a 2 mm grout line a shade darker); skinali:
  glossy glass in its colour (low roughness, slight clearcoat).
- A wall the camera has hidden (`hiddenWalls`) hides its backsplashes.

### In the estimate
- Area per backsplash = its rectangle less the openings' overlap with it (the same pieces as in 3D,
  backend mirrors the openings with `_resolve_element_positions`). Lines in a new category
  `fartuk`, grouped under "Devor pardozi" (pardoz) in both `smeta_groups.py` and `smetaGroups.ts`.
- **Tile** (all tile backsplashes together):

  | Line | Quantity | Price |
  |---|---|---|
  | Fartuk plitkasi | area × 1.10 (waste) m² | the shop's `finish:plitka` median like wall tile, else `wall_tile_m2_uzs` (120 000); approximate |
  | Plitka yelimi, Zatirka | the backsplash tile area is **added to** the room's tile area in the existing adhesive and grout lines | as today |
  | Ish: fartuk plitkasini terish | area m² | 130 000 / m² (`work_backsplash_m2_uzs`) |

- **Skinali** (all together):

  | Line | Quantity | Price |
  |---|---|---|
  | Skinali (shisha fartuk) | area m² (no waste: made to measure) | shop key `skinali` per m², else 450 000 (`skinali_m2_uzs`); approximate without a shop |
  | Ish: skinali o'rnatish | area m² | 80 000 / m² (`work_skinali_m2_uzs`) |

- Formulas: `1.20 m × 0.60 m = 0.72 m²` per backsplash when one; with several, the sum
  `0.72 + 0.48 = 1.20 m² × 1.10 (chiqindi) = 1.32 m²`. Numbers with 2 decimals.
- A wall tiled from the floor whose tile band reaches into a backsplash: the overlap is taken off
  the wall's tile area ("Devor plitkasi" and its laying work), since the backsplash covers it. Paint
  and wallpaper behind a backsplash are **not** taken off (small, and it keeps the paint code as is).
- Norms in `backend/app/data/tile_norms.json`: `work_backsplash_m2_uzs` 130000, `skinali_m2_uzs`
  450000, `work_skinali_m2_uzs` 80000. New shop key `skinali`, sold per m² (`KEY_PACK_UNIT` literal,
  `_PIECE_KEYS` no — it is by area; `SMETA_KEYS` in adminMaterials.ts; the catalog seed test list).
- All new labels read in uz/ru/en (smetaLineText / smeta_text mirror; `smeta_locale.json`
  regenerated); the category label too.

## Settled while checking the design (my calls)
- "The wall's own frame" is `roomModel(geometry).walls` (centre, `dirX/dirZ`, `nx/nz`, length) —
  the frame a door's `position` is measured in; `wallWalk` (the plumbing walk) may run the other way
  and is not used here.
- The block shows when `effectiveRoomType(roomType, roomName)` is `oshxona` (lib/roomType); the
  backend prices backsplashes in any room that has them (`_is_kitchen` is not required), so a room
  whose type changed keeps its estimate honest.
- Backend geometry may be in metres or mm: lengths, positions, widths go through `_to_metres`, as the
  tile code does; `sill_height` is metres, element `height` through `_to_metres`. Backsplash numbers
  are always mm.

## Left to the builder
- Exact panel layout within the existing WallSection style; component split.
- The tile grid texture's making (canvas or shader), as long as it stays cheap on phones.
- Where the shared rectangle-subtraction helper lives (one in TS, its mirror in Python).
