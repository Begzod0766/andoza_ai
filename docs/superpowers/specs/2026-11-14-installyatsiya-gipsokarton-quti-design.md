# Installyatsiya uchun gipsokarton quti — design

Date: 2026-11-14. Approved by the user in chat ("ha, ma'qul, o'zing bajar").

## Intent
A wall-hung toilet's frame (#258: "Installyatsiya" + its fitting work) is always closed in with a
drywall box; the estimate had no line for it.

## Design
- No switch: every wall-hung toilet (the `toilet_wall_hung` part kind) brings, per frame:

  | Label | Qty | Price |
  |---|---|---|
  | Namga chidamli gipsokarton (quti) | 1 dona (one 1.2×2.5 m sheet) | shop `gipsokarton_nam` (dona), else 95 000, approximate |
  | Quti profili (karkas) | 6 m | shop `profil` per metre, else the ceiling profile price (10 000/m), approximate |
  | Ish: gipsokarton quti yig'ish | 1 dona | 300 000 |

- Formulas open with "N unitaz" (translated): `1 unitaz = 1 dona × …`, `2 unitaz × 6 m = 12 m`.
- Lines read in uz/ru/en; `gipsokarton_nam` is taggable in the shop admin.

## Non-goals
- No tile on the box: its face stands in front of wall that is already tiled.
- No revision hatch.

## Approaches
1. **Automatic with the frame (chosen)** — a frame is never left open.
2. A switch — rejected: one more tick for something always needed.
