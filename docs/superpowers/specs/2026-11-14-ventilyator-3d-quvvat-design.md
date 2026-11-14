# Extractor fan in 3D, sized by the room — design

Date: 2026-11-14. Approach 1 approved in chat ("ha, 1-yo'l ma'qul, o'zing bajar"). The owner: the shaft
is always in the bathroom wall, by the riser — so no duct and no separate grille. Follows
`2026-11-10-sochiq-quritgich-ventilyatsiya-design.md` (its "Out of scope": drawing the fan in 3D,
picking the fan by the room's volume).

## Approaches (picked: 1)
1. **Placed by itself by the riser (chosen):** drawn on the riser's wall near the ceiling; follows the
   riser; sized from the room's volume in the estimate.
2. The user slides it along the walls: pointless when the shaft is by the riser.
3. Estimate sizing only, nothing drawn.

## Design
**Where (studio only).** Shown in a bathroom (`effectiveRoomType` = `hammom`) unless
`designState.ventFan` is exactly false. On the riser's wall (`roomRiser`), 300 mm from the riser
towards the wall's middle, its centre clamped 90 mm inside the wall's ends; its top 150 mm below the
ceiling. Not dragged; it moves when the riser moves.

**3D (`VentFan3D`).** A white face 180 × 180 × 30 mm on the wall (2 mm off it), with a round grey
grille Ø120 mm on its front; hidden with its wall (`hiddenWalls`); not raycast.

**Sizing (estimate).** Volume = `floor_area` × `ceiling_h` (2.7 m when unset). Air needed = volume × 6
changes an hour (my call: × 8, said in chat, put Ø125 in nearly every bathroom; 6 is the usual
bathroom rate). Ø100 up to 100 m³/h, Ø125 up to 180, else Ø150. With no floor area, Ø100.

| Line | Change |
|---|---|
| `Tortuvchi ventilyator Ø100` (Ø125, Ø150) | the label names the size; formula `5.00 m² × 2.70 m = 13.5 m³ × 6 = 81 m³/soat → Ø100 = 1 dona × 180 000 so'm`; a tagged `ventilyator` shop product still prices it, as before |
| cable and work | unchanged |

- Norms in `bathroom_extras_norms.json`: `fan_uzs` stays the Ø100 price; `fan_uzs_by_size`
  {100: 180000, 125: 260000, 150: 380000}, `fan_air_changes` 6 — mine, the owner's to correct.
- Labels and the formula's `m³`, `m³/soat` in uz/ru/en, both formula mirrors.

## Anti-goals
- A non-bathroom, or the switch off: nothing drawn, no fan lines (as today).
