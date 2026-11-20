# Towel rail: its size, and a shop product of the user's own — design

Date: 2026-11-15. Approach 1 approved in chat ("ha, 1-yo'l ma'qul, o'zing bajar"). Follows
`2026-11-10-sochiq-quritgich-ventilyatsiya-design.md` (its "Out of scope": choosing the rail's size, or
a particular shop product) and the electric rail (2026-11-14).

## Approaches (picked: 1)
1. **Size and product, picked apart (chosen):** a size per rail (3D, points, the norm price) and a
   shop product for the room's rails, as the ceiling's board and profile are picked.
2. Product only: the 3D and the points stay 50 × 80.
3. Size only: the estimate stays on the cheapest tagged product.

A shop product has no size of its own (`Material` has none), so the two cannot be matched by the
program; the product's name, which usually carries its size, is shown in the list.

## Design
**Size.** `TowelRail.size?: '500x500' | '500x600' | '500x800' | '600x800' | '600x1000'` (width ×
height, mm). Absent = `500x800`, so every rail saved so far reads as today; an unknown value is dropped
on load (frontend `saneRails`) and read as absent by the estimate.
- Points: the feed and the return are half the rail's **width** either side of its centre (shared
  fixture `towelRailPoints.json` gains a 600-wide case).
- Placement: a rail keeps half its own width clear of the wall's ends, openings and machines;
  a machine keeps clear of half the rail's width. Changing a rail's size moves it to the nearest free
  place for the new width; with none on its wall the size is not changed (the panel says so).
- 3D: the ladder is the size's width and height; its rungs `max(4, round(h / 130))`.

**Product.** Through the existing pick mechanism: `surfaces["smeta:sochiq_quritgich"]` and
`surfaces["smeta:sochiq_quritgich_el"]` (`PICKABLE_SMETA_KEYS`, `ShopPickList`), shown in the rail
block when a rail of that kind is there. One pick prices every rail of that kind in the room.

**Estimate** (water rails; electric ones the same with their own key and norms):
- A picked product, else the cheapest tagged product (as today): one line `Sochiq quritgich: <name>`,
  qty = the rails.
- Neither: one line per size, `Sochiq quritgich (50×80)`, at that size's norm, approximate.
- Norms in `bathroom_extras_norms.json`, `towel_rail_uzs_by_size` {500x500 450 000, 500x600 520 000,
  500x800 650 000, 600x800 750 000, 600x1000 900 000} and `el_towel_rail_uzs_by_size` {650 000,
  750 000, 900 000, 1 050 000, 1 250 000}; the 500x800 prices are today's. Mine, the owner's to correct.
- Labels in uz/ru/en for the ten sized lines.

**Panel.** Each rail row gets a size select (`50×50 … 60×100 sm`); under the rails, "Do'kondan
tanlash" lists for the kinds present.

## Anti-goals
- A rail saved before this (no `size`) draws, places, points and prices exactly as today unless a
  shop product is picked.
