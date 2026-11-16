# A dishwasher in the kitchen — design

Date: 2026-11-16. Approach 1 picked in chat ("1"). Follows the washing machine
(`2026-11-13-kir-yuvish-trap-design.md`, whose "Out of scope" listed a dishwasher) and its socket
(2026-11-14).

## Approaches (picked: 1)
1. **Like the washing machine (chosen):** a button in a kitchen's Santexnika panel; a box drawn in
   code, 60 or 45 cm wide, slid along a wall; its points join the pipe scheme; priced connection and
   socket. Reuses the machine's placing, dragging, keeping, 3D, clash warning and saving.
2. A switch only: estimate lines, nothing drawn, no points.
3. Built into the kitchen furniture: the kitchen has no cabinet-run object.

## Design
**Data.** A dishwasher is a machine in the room's `washers` with `kind: 'dishwasher'` and
`widthMm: 600 | 450` (absent kind = a washing machine, as every machine saved so far; absent or
unknown width = 600). An unknown kind is read as a washing machine; an unknown width drops to 600.

**Size.** 600 or 450 wide × 570 deep × 820 high, its back 20 mm off the wall (a washing machine stays
600 × 600 × 850). Every rule that used the machine's half width uses the machine's own now: the
free places (doors with their architrave, rails, other machines, the riser), placing, keeping after
a shape change, the towel rail keeping clear of it, the furniture clash warning.

**Points** (shared fixture `washerPoints.json` gains dishwasher cases, frontend lib/washer and backend
app/services/washer): cold Ø20 at centre + offset, drain Ø50 at centre − offset, both 500 mm high;
offset 150 mm (600 wide) or 100 mm (450). Shown as "(idish mashinasiniki)".

**Panel.** In a kitchen (`effectiveRoomType` = `oshxona`) a "Idish yuvish mashinasi" block: rows
(wall, a width select 60 / 45 sm, remove, the clash warning) and "Idish yuvish mashinasi qo'shish"
(placed like the washing machine: shortest pipe run to the riser, clear of furniture; "no room" said).
A width that does not fit on its wall is refused and said. Listed and removable in any room.

**3D.** A white box with a grey control strip along its top front; draggable in the Santexnika stage.

**Estimate** (per dishwasher; the machine itself is not priced), category `santexnika`:

| Line | Price |
|---|---|
| Idish yuvish mashinasi krani (uchlik bilan) | shop key `kran_idish`, else 70 000 |
| Idish yuvish mashinasi sifoni (chiqishli) | shop key `sifon_idish`, else 90 000 |
| Ish: idish yuvish mashinasini ulash | 200 000 |
| Idish yuvish mashinasi rozetkasi (IP44) | shop `rozetka_ip44`, else 70 000 |
| Elektr kabel (idish yuvish mashinasi) | 3 m × shop `kabel` / default |
| Ish: idish yuvish mashinasi rozetkasini o'rnatish | 50 000 |

Norms: `plumbing_norms.json` `part_uzs.kran_idish`, `part_uzs.sifon_idish`, `work_dishwasher_uzs`;
the socket reuses the washing machine's norms. All in the admin "Narxlar" catalog. New shop keys
`kran_idish`, `sifon_idish` (by the piece). Labels in uz/ru/en.

## Anti-goals
- A room with no dishwasher draws and prices exactly as today; washing machines are unchanged.
