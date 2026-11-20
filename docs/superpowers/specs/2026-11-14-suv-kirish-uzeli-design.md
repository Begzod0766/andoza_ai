# Suv kirish uzeli (hisoblagich, filtr, reduktor) — design

Date: 2026-11-14. Approved by the user in chat ("ha, ma'qul, o'zing bajar").

## Intent
A bathroom or kitchen renovation often replaces the flat's water inlet: a meter, a coarse filter, a
pressure reducer and a check valve on each incoming line. Today the estimate has none of these
(only the shut-off valve per line, "Sharli kran Ø20", which stays as it is).

## Design
- A switch in the Santexnika panel, "Suv kirish uzeli (hisoblagich, filtr, reduktor)", stored as
  `designState.waterInlet`; **off unless exactly true** (like `waterHeater`, `floorDrain`).
- Switched on, the estimate (`santexnika` category) gets, per incoming line:

  | Label | Shop key | Norm, so'm |
  |---|---|---|
  | Suv hisoblagichi | `hisoblagich_suv` | 180 000 |
  | Dag'al filtr | `filtr_suv` | 60 000 |
  | Bosim reduktori | `reduktor` | 250 000 |
  | Teskari klapan | `klapan_teskari` | 40 000 |
  | Ish: suv kirish uzelini yig'ish | — | 200 000 |

- **Lines:** cold always (every flat has it); hot too when the room has a hot point and the water
  heater is **not** switched on (with a boiler the hot water is made in the flat). So 1 or 2.
  The formula opens with the why: `2 liniya = 2 dona × …` ("liniya" is translated; a
  "(sovuq, issiq)" note would not be, so it is left out).
- Parts priced like the other pieces (`_piece_line`): a shop product tagged with the key and sold
  by the piece gives its price; otherwise the norm, marked approximate.
- Lines read in uz/ru/en like every estimate line (smetaLineText / smeta_text mirror).
- The four keys are taggable in the shop admin (sold by the piece).

## Non-goals
- No sealing ("plombalash") fee: it differs by city.
- No 3D object; the inlet is not drawn.
- The shut-off valve is not added again.

## Approaches
1. **A switch, lines per incoming line (chosen)** — matches the heater and floor-drain switches; the
   count follows the room's pipes and the boiler.
2. Always add the inlet — rejected: many renovations keep the meter, the estimate would overcharge.
3. A 3D inlet unit by the riser — rejected for now: more work, nothing in the estimate needs it.
