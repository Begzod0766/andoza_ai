# 3D studio: room-first view, wall framing, themed panels, phone hint

**Date:** 2026-11-03 · **Status:** approved in chat · **Area:** `/studio/:roomId/*` (`ThreeDPage`, `pages/studio/three-d/*`, `components/studio/*`), `/smeta` header

## Why

A design critique of the studio on prod, in the night theme, found these problems:

- **The opening view loses the room.** The studio opens on the whole flat from far above, so the room being edited (3.9 m², 4 walls) is a small grey shape in a chain of rooms. Picking a paint shows almost nothing.
- **Unlabelled ⛶ marks.** One sits over every room. They are the "look at this room on its own" toggles (`SiblingRoomLayout`, `lib/roomFocus`), but no mark carries its room's name.
- **The sky is too bright.** The sun glare at the top is the first thing the eye lands on.
- **Wall names count from zero.** The chips read "Wall 0 … Wall 3", and nothing shows which chip is which wall in 3D.
- **Shop tiles are bare.** They show a grey square and a repeated name ("Краска Polisan" three times) with no price.
- **"Discard the design" is the loudest control.** It is a red button, always visible.
- **The camera and lock icons have no visible label.** It is unclear whether editing is locked.
- **Panels ignore the theme.** The stage rail and the design panel stay white in the night theme, and the rail stops halfway down.
- **The Estimate tab has its own header,** laid out differently from the 3D tab. It showed "Loading…" for a while.
- **Phone users get no pointer.** On a phone the only way to the tools is tapping a surface, and nothing says so.

**Success means:**

- The studio opens on the user's own room, close enough to see a change.
- A wall picked in the panel is lit and turned to.
- Every room mark is named.
- The panels follow the theme.
- A first-time phone user knows to tap a surface.

## Decisions (from the brainstorm)

- **Opening view:** the active room on its own, framed. A "Kvartira" toggle shows the whole flat. Room marks carry names.
- **Wall framing:** a three-quarter view from above. The walls nearest the camera are cut away (the existing cutaway). The picked wall is highlighted, and the camera turns to face it.
- **Phone:** keep the surface-tap flow, with no stage strip; the user removed it on 2026-09-28. Add a one-time hint.

## Out of scope

- The estimate maths and the stage logic.
- Placement, walkthrough and isometric modes.
- LiDAR scanning.
- The mobile app (it benefits through the WebView).
- Furniture catalogue content.

## 1. Opening view and the flat toggle

**Opening view**
- `initialRoomFocus` returns the active room by default.
- `?focus=0` opens the flat view. It replaces today's `?focus=1` opt-in, which is kept as an alias for the focused view.
- On load, and on every room switch, the camera frames the focused room with the existing `CameraAnimator`:
  - three-quarter view;
  - pitch about 35° down;
  - the room's bounding box filling about 70 % of the shorter canvas side.

**"Kvartira ⇄ Xona" toggle**
- A pill button at the bottom-right of the canvas, next to the existing round button.
- It switches between the focused room and the whole flat, and frames the matching extent.
- Label: "Kvartira" when a room is focused, "Xona" when the flat shows.
- `aria-pressed` reflects the flat view.
- On a phone, it shows its icon plus the short label.

**Room marks**
- Every ⛶ room mark shows the room's name next to the bracket icon, as a pill.
- The active room's mark uses the accent fill; the others use the card fill.
- Long names truncate at 16 characters with an ellipsis. The full name goes in `title`.

**Sky**
- `BrandedSky` / `skyIntensity` is capped so the sky's peak never washes out the top of the frame. The target is a measured backdrop luminance at or below today's at sunset.
- Ambient and sun light on the room are unchanged, so materials keep their colour.

## 2. Wall picking and framing

- **Labels.** Wall labels are one-based everywhere a user reads them: the studio chips ("Devor 1 … Devor 4") and the estimate lines ("Devor 2: 3 rulon …").
  - This applies to the `wall_n`, `devor_nomi`, `devor_rulon_*` and `el_where` strings, through one helper: `wallLabel(index) = index + 1`.
  - Wall ids in data are unchanged.
- **Hover or focus.** Pointing at a wall chip, or focusing it with the keyboard, highlights that wall in 3D with the existing `SelectionOutline`.
- **Selection.**
  - Selecting a wall chip highlights the wall and animates the camera (about 400 ms) to face it from the three-quarter view, with the existing cutaway making the walls between the camera and the picked wall transparent.
  - Selecting "Hamma devorlar" returns the camera to the room frame.
- **Tapping a wall in 3D** keeps today's behaviour and also selects the matching chip.
- **Reduced motion.** With `prefers-reduced-motion`, the camera jumps instead of animating.

## 3. Panels, header, theme

**Theme**
- The stage rail (`PhaseStageNav`) and the design panel (`DesignPanelDock`, `DesignPanel`, `components/studio/design-panel/*`) use the theme tokens: `bg-card`, `bg-card-soft`, `text-ink`, `text-ink-muted`, `border-line`, `accent`, `warn`, `ok`.
- There are no `bg-white`, `text-neutral-*`, `bg-neutral-*` or raw `text-blue-*` / `text-emerald-*` classes. A source-scan test guards this, as it does for mebel.

**Stage rail**
- It fills the full height of the canvas column, so no empty band appears below "Furniture".
- Done stages use `text-ok` with a check mark. The current stage uses an `accent` fill.

**One studio header**
- `SmetaPage` uses the same header as the 3D tab:
  - back button and room name on the left;
  - the "3D | Smeta" control in the centre;
  - the ⋮ menu on the right.
- While the estimate loads, it shows skeleton rows instead of "Loading…".

## 4. Design panel content

**Shop product tiles**
- Each tile shows, in this order:
  - a colour swatch (the product's `color_hex`), or its image, or the category initial;
  - the name with any code or shade, two lines at most;
  - the price per unit (`formatUZS` / unit).
- Tiles of the same product name are told apart by their code or shade.

**"Dizaynni bekor qilish"**
- It moves out of the panel into the header's ⋮ menu.
- It asks first with the existing confirm dialog: "Xona dizayni boshlang'ich holatga qaytadi. Bu amalni ortga qaytarib bo'lmaydi."

**Canvas icon buttons**
- The camera button and the lock button carry visible labels on screens `md` and up: "Kameralar", and "Tahrirlash: yopiq" or "Tahrirlash: ochiq".
- On a phone they keep icons only, with `aria-label` / `title`.
- The lock's state shows in both its icon and its label.

## 5. Phone

- No new navigation: the surface tap and radial menu stay.
- **One-time hint.** The first time the studio opens on a phone (under `md`), a dismissible hint sits above the canvas bottom: "Devor, pol yoki shiftni bosing — rang va materialni tanlang."
  - It closes on its × button or on the first surface tap.
  - It is remembered in `localStorage` as `studio.tapHint.seen`. Every read and write is in try/catch, and the hint simply shows again if storage fails.
- **Header line.** On a phone the header's room line shows the current stage: "Mening xonam · Bo'yoq".

## Copy

- All new strings are in uz / ru / en.
- Numbers and dates use `intlLocale()`.

## Testing

- **Opening view:**
  - the studio opens focused on the active room;
  - "Kvartira" shows the siblings and sets `aria-pressed`;
  - `?focus=0` opens the flat.
- **Room marks:** every mark shows its room name, and the active mark is styled apart.
- **Wall labels:** the chips read "Devor 1…4", and the estimate's wall lines use the same numbers (shared helper).
- **Wall chips:**
  - hovering a chip highlights that wall;
  - selecting one calls the camera-target function with that wall;
  - "Hamma devorlar" resets the target;
  - with reduced motion there is no animation.
- **Theme scan:** none of the light or raw classes listed in section 3 remain in the studio panel files.
- **Estimate:** the page renders the shared studio header, and skeleton rows while loading.
- **Shop tile:** it shows the swatch, the name with its code, and the price.
- **Discard:** it is not in the panel, it is in ⋮, and it asks first.
- **Canvas buttons:** they show labels from `md` up, and the lock label reflects its state.
- **Phone hint:**
  - it shows once and closes on × or on a tap;
  - it is stored, and storage failures are safe;
  - the phone header shows the stage.
- **Prod:** screenshots in day and night, at desktop width and at 375 px.
