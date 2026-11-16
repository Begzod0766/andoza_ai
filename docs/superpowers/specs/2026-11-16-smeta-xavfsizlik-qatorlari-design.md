# Estimate: the safety and testing lines of a plumbing renovation — short design

Date: 2026-11-16. First of the seven gaps found comparing the studio with a real bathroom renovation
(SNiP 3.05.01-85 §4.4 pressure test, SP 256 RCD ≤ 30 mA, equipotential bonding, revision hatches).
Approved in chat ("ha, ma'qul, o'zing bajar").

## Approaches
1. **Always with the room, by its type (chosen):** like demolition and chasing; every renovation has them.
2. A switch per line: five more controls for lines nobody leaves out.
3. A separate "electrics" category: an `elektr` line switches on the wiring-plan notice.

## Design
In a room with plumbing points, category `santexnika`:

| Line | Where | Qty | Price |
|---|---|---|---|
| UZO (difavtomat 30 mA) | bathroom, kitchen | 1 | shop `uzo`, else 250 000 |
| Potensiallarni tenglash qutisi (KUP) va kabel | bathroom | 1 komplekt | 150 000 |
| Ish: potensiallarni tenglash | bathroom | 1 komplekt | 150 000 |
| Ish: quvurlarni bosim bilan sinash (opressovka) | bathroom, kitchen | 1 komplekt | 150 000 |
| Revizion lyuk (plitka ostiga) | bathroom | 1 | shop `lyuk`, else 250 000 |
| Ish: revizion lyuk o'rnatish | bathroom | 1 | 100 000 |
| Sanitariya silikoni | bathroom, kitchen | a tube per 2 fixtures, ≥ 1 | shop `silikon`, else 45 000 |

Norms in `plumbing_norms.json` `safety` (in the admin "Narxlar" catalog); new piece keys `uzo`, `lyuk`,
`silikon`; labels in uz/ru/en. A room with no plumbing points is unchanged.
