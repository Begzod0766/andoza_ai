# A washing machine or towel rail touching furniture: a warning — design

Date: 2026-11-15. Approach 1 approved in chat ("ha, 1-yo'l ma'qul, o'zing bajar"). Follows the washing
machine (2026-11-13: "Out of scope: checking the machine against furniture while it is dragged") and
the towel rail (2026-11-10: "Out of scope: checking a rail against furniture").

## Approaches (picked: 1)
1. **A warning only (chosen):** the panel row says which piece it touches, and in the Santexnika
   stage the item is drawn reddish. Nothing moves by itself.
2. Stopping a drag at furniture: furniture would have to stop at them too, or it is half done.
3. Both.

## Design
- **Solids** (world metres, `lib/wallItemClash`):
  - a machine: its floor box (`washerBox`), 0 – 850 mm high;
  - a rail: on its wall at its place, from the wall face 60 mm into the room, its size's width, from
    its `heightMm` to `heightMm` + its height;
  - a piece of furniture: its footprint as drawn (`placedFurnitureBoxes`: scale, ceiling fit), from
    the floor to its drawn height (catalog `height_cm`, an upload's own size; unknown 0.8 m). A rug is
    left out.
- **Touching** = the footprints overlap (`overlaps`, no margin) and the height ranges overlap (both
  open: a rail starting exactly where a piece ends does not touch).
- **Panel:** a touching machine's or rail's row shows, in red, "Mebelga tegib turibdi: <names>"
  (each piece named as the furniture panel names it), `role="alert"`.
- **3D:** in the Santexnika stage only, a touching machine's body and a touching rail's bars are
  drawn in a warning red (`#F87171`); otherwise as before.
- Text in uz/ru/en. Frontend only: the estimate is unchanged.

## Anti-goals
- Nothing is moved, blocked or saved by this; a room with no clash looks exactly as today.
