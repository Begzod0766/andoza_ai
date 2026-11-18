# Bosqichlar 0→100% — stage split and a stage-aware 3D

Date: 2026-11-18 · Item 6 of the approved bathroom plan

## Intent

The studio's renovation stages should read like a real renovation, start to finish, so that a
user (bathroom first, every room after) sees the room go from bare walls to finished.
Two parts:

1. Split "Santexnika" into **Quvurlar** (pipes, before Suvoq) and **Jihozlar** (fixtures,
   where Santexnika sits now, after Pol/Montaj).
2. Make the 3D show the room **as it is at the chosen stage**, cumulatively: "3D ham o'zgarsin,
   0 dan 100% gacha ko'rinsin".

Why: a realistic bathroom flow end to end is what makes the app attractive to many users.

## Goals

- Stage order in a hammom / oshxona: Quvurlar → Suvoq → Shpaklovka → Bo'yoq → Pol → Montaj →
  Jihozlar → Chiroq → Mebel. Other rooms keep their seven stages (no Quvurlar, no Jihozlar).
- Picking a stage in the stage list shows the room at the end of that stage: everything from
  that stage and the earlier ones is drawn, everything from later stages is not.
- Nothing is ever deleted or changed by switching stages: it is only drawn or not.
- A short banner explains what is hidden and how to see it.
- Render inputs (360 panorama, camera stations) and the project-card thumbnail always show 100%.

## Non-goals

- No new textures (bare masonry, screed) in this item: the earlier stages are drawn with the
  materials we already have, in neutral tones.
- No change to the estimate (smeta), the backend or stored room data.
- No animation between stages.

## Anti-goals

- "My things disappeared." An earlier decision (comment in ThreeDCanvasScene.tsx) removed a
  phase-forced plaster wall because users lost sight of what their walls carried. So the studio
  never hides things the user did not ask to hide: by default it opens at 100%, and quick edits
  from the 3D keep it at 100% (below).
- A render or thumbnail of a half-built room.

## Approaches considered

1. **Picked:** every stage shows the room as at that stage, cumulatively, with a banner;
   renders always use 100%.
2. A separate "Jarayon" slider for 0→100% while editing always shows the full design. Nothing
   hides, but two views to learn and the slider is easy to miss.
3. Only Quvurlar/Jihozlar are stage-aware. Smallest, but not the 0→100% the user asked for.

Within 1 the user picked rule **A** over B: the 3D changes only when a stage is picked in the
stage list; the studio opens at 100%; quick edits keep 100%. (B, "3D always follows the
panel's stage", would hide the sofa when a user taps the wall beside it to repaint.)

## Design

### Stages and panels (PR 1)

- `PhaseKey` gains `quvurlar` and `jihozlar` and loses `santexnika`. RENO_STAGES order as in
  Goals. `visibleStages()` shows both only in hammom / oshxona.
- `?phase=santexnika` (old links, possibly the mobile app) maps to `jihozlar`.
  `?phase=quvurlar` works too. Other `?phase=` values unchanged.
- SantexnikaSection splits into two sections; shared helpers stay shared.
  - **Quvurlar:** plumbing points (add/remove), riser (wall, position, auto), "show pipe runs",
    pipes in the wall, old plumbing demolition, floor drain, water inlet, the drain/water
    summary line.
  - **Jihozlar:** fixtures list + clearance warnings, towel rails, washers / dishwasher, water
    heater, bath / shower screens, vent fan.
- The heated floor stays in Pol.
- Radial menu: the "Santexnika" ring entry becomes "Jihozlar" (opens the Jihozlar panel); its
  "add point" item opens Quvurlar.
- The mobile bottom-sheet layout DesignPanelDock uses for Santexnika applies to both stages.
- `plumbingStage` (store) is on in either stage, as today in Santexnika: dragging rails,
  machines and the riser, shower zones and clash red. (Builder's call: only the riser drag
  could move to Quvurlar alone later.)
- i18n uz/ru/en: stage labels "Quvurlar" / "Jihozlar" (ru "Трубы" / "Сантехприборы", en
  "Pipes" / "Fixtures").

### The view stage (PR 2)

- New store field `viewStage: PhaseKey | 'full'`, default `'full'`. The 3D reads only this;
  the design panel keeps reading `activePhase`.
- Set to the picked stage when the user picks one in the stage list (PhaseStageNav,
  StagePillLayer) and when the studio opens with `?phase=` (mobile wizard and wall-condition
  hand-off).
- Set to `'full'` by every quick path: radial-menu edits (`openPanelAt`, `openPaintPanel`,
  placing a socket or a light from the ring), and by entering the 360 camera or a camera
  station.
- Opening without `?phase=` and without the Mebel / Chiroq tab: `activePhase` becomes the
  room's last stage (Mebel) instead of Bo'yoq, and `viewStage` is `'full'`.
- The stage list shows the current panel stage as today. When `viewStage` is a stage, the 3D
  shows that stage.

### What each stage draws (PR 2)

A pure function `drawnAt(itemStage, viewStage, stages)` decides; every 3D layer asks it.
`'full'` draws everything.

| Thing | Its stage |
|---|---|
| Room shell, doors, windows, floor drain grate, plumbing points, pipe runs (when ticked) | always |
| Riser as a bare pipe | until Suvoq; from Suvoq on it is boxed (BathroomBoxes3D) |
| Bathroom boxes (riser boxing) | Suvoq |
| Wall covering of kind plaster / Suvoq texture | Suvoq |
| Wall covering paint / wallpaper / tile, ceiling covering, backsplash, cornice | Bo'yoq |
| Floor covering, skirting | Pol |
| Sockets, switches, other electricals | Montaj |
| Furniture of role plumbing (bath, sink, toilet, shower), towel rails, machines, vent fan, screens, water heater | Jihozlar (in an oshxona, plumbing-role furniture goes with Mebel: a kitchen sink sits in its cabinet) |
| Light fixtures and their lights | Chiroq |
| All other furniture | Mebel |

Before a surface's own stage it is drawn as the stage's bare look, with existing materials:

| View stage | Walls | Floor | Ceiling |
|---|---|---|---|
| Quvurlar | plaster PBR, dark grey (bare masonry) | flat grey (screed) | plain light grey |
| Suvoq | plaster PBR, plaster tone (or the user's Suvoq texture) | flat grey | plain light grey |
| Shpaklovka | smooth off-white, no relief | flat grey | off-white |
| Bo'yoq and later | the real covering | flat grey until Pol | the real covering |

Scene lighting stays on in every stage, so the room is never dark before Chiroq.
Hidden things are unmounted (not `visible={false}`), so they cannot be clicked (raycasting
ignores `visible`).

### Banner (PR 2)

When `viewStage` hides anything that exists, a small banner sits over the canvas top:
"Bu bosqichda {mebel, chiroqlar, …} hali yo'q" with a button "Tayyor xonani ko'rish" that sets
`viewStage` to `'full'`. Shown only when something is actually hidden.

### Renders and thumbnails (PR 2)

- Entering the 360 camera or a camera station sets `viewStage = 'full'`, so the panorama and
  the station stills (MyArchitectAI inputs) are always 100%.
- The project-card thumbnail (unmount / `__captureRoomThumbnail`) is uploaded only when
  `viewStage` is `'full'`; otherwise the previous thumbnail stays.
- The user's own "Skrinshot" keeps what they see.

## Constraints

- Room data and the API do not change; `viewStage` is never saved.
- Mobile WebView: `?phase=` keeps working; ask on andoza_ai_mobile#63 whether the app links
  `?phase=santexnika` or depends on the stage list.
- Performance: unmounting is a deliberate switch, as with FocusFade; GLTFs stay cached.

## PRs

1. Stage split + panel split + `?phase=santexnika` → Jihozlar.
2. View stage, stage-aware 3D, banner, open at 100%, render/thumbnail rule.

## Left to the builder

- Exact grey values and the Shpaklovka off-white.
- The banner's look (follow existing canvas chips).
- Component boundaries of the two new sections.
