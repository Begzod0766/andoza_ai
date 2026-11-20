# Elektr sochiqquritgich — design

Date: 2026-11-14. Approved by the user in chat ("ha, ma'qul, o'zing bajar").

## Design
- `TowelRail.kind?: 'water' | 'electric'`; absent or anything else = water (every saved room as before).
- Panel (Santexnika rail list): a "Suvli | Elektr" switch per rail; a new rail is water. One undo step.
- Electric: no hot water points (studio and estimate, the shared rule in towelRailPoints.json), so no
  pipes or chasing for it. In 3D the same ladder with a small white connection box at its side.
- Estimate per electric rail (santexnika): "Elektr sochiq quritgich" (shop `sochiq_quritgich_el`,
  else 900 000), "Namga chidamli rozetka (IP44)" (shop `rozetka_ip44`, else 70 000), "Elektr kabel
  (sochiq quritgich)" 3 m × the shop's kabel per metre, else the default cable price, approximate,
  "Ish: elektr sochiq quritgichni o'rnatish" 150 000. Water rails keep "Sochiq quritgich" and its work.
- Norms in bathroom_extras_norms.json; keys sold by the piece; text in uz/ru/en.

## Approaches
1. **A kind on the existing rail (chosen)** — placing, dragging, undo and saving already work.
2. A separate electric rail list — rejected: duplicates all of that.
