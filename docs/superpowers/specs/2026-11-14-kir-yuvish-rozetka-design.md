# Kir yuvish mashinasi rozetkasi — short design

Date: 2026-11-14. Approved in chat ("ha, ma'qul, o'zing bajar"). Follows `2026-11-13-kir-yuvish-trap-design.md`
(its "Out of scope": an electric socket line for the machine).

## Intent
A washing machine needs a moisture-proof socket of its own; the estimate prices its tap, trap and
connection but not the socket, its cable or fitting it.

## Approaches
1. **Always with the machine (chosen):** each placed washer brings its socket, cable and work, like the
   wall-hung toilet's drywall box. In a renovation the machine almost always gets a new socket.
2. A switch "rozetka bor": one more control for a rare case.
3. Count it from sockets placed in the electrical stage: those are not tied to a machine.

## Design
Per washer (`n` = valid washers), in category `santexnika` (not `elektr`, so no wiring notice):

| Line | Quantity | Price |
|---|---|---|
| Kir yuvish mashinasi rozetkasi (IP44) | `n mashina = n dona` | shop key `rozetka_ip44` (dona), else `socket_ip44_uzs` 70 000, approximate |
| Elektr kabel (kir yuvish mashinasi) | n × 3 m (`washer_cable_m`) | shop `kabel` per m, else `ELEC_CABLE_PRICE_UZS`; approximate |
| Ish: kir yuvish mashinasi rozetkasini o'rnatish | n dona | 50 000 (`work_washer_socket_uzs`) |

- Norms in `bathroom_extras_norms.json` beside the electric rail's socket.
- Its own label (not the rail's "Namga chidamli rozetka (IP44)") so the two never share a line label.
- Sockets placed in the electrical stage only add wiring points, so the device is not counted twice;
  at most ~3 m of cable may be.
- Labels in uz/ru/en (smetaLineText / smeta_text mirror, locale regenerated). Backend only.
- Anti-goal: a room with no washer prices exactly as before.
