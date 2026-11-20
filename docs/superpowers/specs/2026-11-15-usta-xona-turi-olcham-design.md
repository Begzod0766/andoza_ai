# The wizard starts a room at its type's usual size — short design

Date: 2026-11-15. Approved in chat ("ha, ma'qul, o'zing bajar").

## Why
The room type is already picked on the wizard's first step, but every new room still starts at
4 × 3 m, so a bathroom was offered 4 m walls. (The earlier 7.4 m came from the last room's walls,
fixed in #216.)

## Approaches
1. **The picked type sets the untouched walls (chosen).**
2. Move the type to a step of its own: it is already first; nothing gained.
3. Ask for the size by type in a dialog: one more tap for a default.

## Design
- `lib/roomTypeSize`: wall A × B per type: hammom 2.5 × 2.0, oshxona 3 × 3, yotoqxona 4 × 3.5, bolalar
  3.5 × 3, mehmonxona 5 × 4, kabinet 3 × 2.5, balkon 3 × 1.2 m (C = A, D = B); no type 4 × 3.
- On a type change in the wizard the walls take the new type's size only when the room is the
  4-wall ABCD rectangle with no doors or windows, still at the previous type's size (no type: 4 × 3).
- Never for a drawn or scanned room (`from=draw|scan`); walls the user set are never overwritten.
- The sizes are my estimates, the owner's to correct.
