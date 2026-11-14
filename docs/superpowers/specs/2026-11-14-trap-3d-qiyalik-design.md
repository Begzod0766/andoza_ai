# Floor drain in 3D and the shower zone's slope — design

Date: 2026-11-14. Approach 1 approved in chat ("ha, 1-yo'l ma'qul, o'zing bajar"); the owner wants both
the 3D view and the estimate. Follows `2026-11-13-kir-yuvish-trap-design.md` (its "Out of scope":
showing the floor drain in 3D, or sloping the floor to it).

## Intent
With "Poddonsiz dush (trap)" on, the estimate prices a floor drain per shower, but the user sees
nothing in 3D, and the screed that slopes the shower zone to the drain is not priced at all.

## Approaches (picked: 1)
1. **Shower zone only (chosen):** a 15×15 cm steel grate at each shower's centre; the shower's own
   floor footprint is the zone that is sloped and priced.
2. The whole bathroom floor sloped to the drain: more screed than a tray-less shower needs.
3. A linear drain along the wall, point or linear picked: two drain kinds, two prices; much larger.

## Design
**Which showers.** Exactly those the floor drain already counts: placed pieces whose role is
`shower` (tray, cabin or panel), only when `designState.floorDrain` is exactly true.

**Zone.** A shower's zone is its catalog footprint (`footprint_w` × `footprint_d`, cm) times its
`scaleOverride` (finite and > 0, else 1); a side the catalog lacks is 90 cm. Centred on the piece
and turned with it. One rule on both sides, pinned by `fixtures/floorDrainZones.json`.

**3D** (`FloorDrains3D`):
- A grate 150 × 150 mm, 4 mm thick, brushed steel, with darker slots, at the zone's centre on the
  floor. Always drawn while the switch is on (a tray model may cover it; the model is not changed).
- In the Santexnika stage only: the zone's outline and its four corner-to-centre lines (the usual
  drafting sign of a floor falling to a drain), 3 mm above the floor, not raycast.

**Estimate** (category `santexnika`, after `Ish: trap o'rnatish`), when on and with a shower:

| Line | Quantity | Price |
|---|---|---|
| Qiyalik styajkasi aralashmasi | zones' area × 54 kg/m² (3 cm average) ÷ 25 kg, rounded up, qop | shop key `styajka` (dona = one bag), else 45 000 per bag; approximate |
| Ish: dush zonasini trapga qiyalatish | zones' area, m² | 150 000 / m² |

- Formulas: `0.90 m × 0.90 m = 0.81 m²` for one; several summed `0.81 + 1.20 = 2.01 m²`; the mix
  `0.81 m² × 54 kg = 43.7 kg ÷ 25 kg → 2 qop`.
- Norms in `plumbing_norms.json` (`floor_slope`: `mix_kg_m2` 54, `bag_kg` 25, `bag_uzs` 45000,
  `work_m2_uzs` 150000) — my estimates, the owner's to correct.
- New shop key `styajka`, sold by the piece (a bag): `KEY_PACK_UNIT` literal `None`, `_PIECE_KEYS`,
  `SMETA_KEYS`, the catalog seed test list.
- Labels in uz/ru/en (smetaLineText / smeta_text mirror, locale regenerated).

## Anti-goals
- With the switch off, or no shower, nothing is drawn and the estimate is exactly as today.
- The shower's model, points and the pipe scheme do not change.

## Left to the builder
The grate's slot pattern; line colours within the studio theme.
