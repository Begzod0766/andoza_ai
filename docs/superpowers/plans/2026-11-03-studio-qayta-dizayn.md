# 3D studio redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The studio opens on the user's room, framed; a Kvartira/Xona toggle and named room marks; walls labelled from 1, lit on hover and turned to on select; a gentler sky; themed stage rail and design panel; Smeta under the same header; clearer shop tiles, discard behind ⋮, labelled canvas buttons; a one-time phone hint.

**Architecture:** Pure helpers carry the decisions (`lib/wallLabel.ts`, `lib/roomFocus.ts`, `lib/wallFraming.ts`, `lib/skyEnvironment.ts`) and are unit-tested; components wire them: `ThreeDCanvasScene` (focus default, camera target), `SiblingRoomLayout` (named marks, flat toggle), `RoomShell` (hover outline), `ThreeDPage` (selected/hovered wall, hint, stage line), panels (tokens), `SmetaPage` (shared header).

**Tech Stack:** React + react-three-fiber/drei, TanStack Query, Vitest + Testing Library, Tailwind theme tokens (`card`, `ink`, `line`, `accent`, `warn`, `ok`).

**Spec:** `docs/superpowers/specs/2026-11-03-studio-qayta-dizayn-design.md`

## Global Constraints

- No change to estimate maths, stage logic, placement/walkthrough/isometric modes, LiDAR, or wall ids in data.
- Framing: pitch ≈ 35° down; room bbox ≈ 70 % of the shorter canvas side; wall turn ≈ 400 ms; `prefers-reduced-motion` → jump.
- `?focus=0` opens the flat; default (and legacy `?focus=1`) opens the active room focused.
- Room-mark names truncate at 16 chars with "…", full name in `title`.
- Hint key `studio.tapHint.seen`; storage in try/catch; hint under `md` only.
- Theme scan bans `bg-white`, `text-neutral-*`, `bg-neutral-*`, raw `text-blue-*`/`text-emerald-*`/`text-amber-*` in the panel files.
- Copy uz / ru / en; numbers via `intlLocale()`.

## Review Focus

1. A room whose wall ids are letters (A–D legacy wizard rooms) or `W3`-style → labels stay as they are; only numeric ids shift to 1-based (Task 1 test).
2. Switching rooms from ⋮ while the flat view is on → the new room opens focused and framed, not stuck in flat view (Task 2 test).
3. Selecting a wall, then dragging the camera, then selecting the same wall again → the camera turns back to it (version bump on every select) (Task 3 test).
4. A room with no geometry yet (empty walls) → selecting "Hamma devorlar" or any framing does not throw; camera keeps its place (Task 3 test).
5. The phone hint must not cover the radial menu: the first surface tap both dismisses it and opens the menu (Task 6 test).

---

### Task 1: One-based wall labels

**Files:**
- Create: `frontend/src/lib/wallLabel.ts`, `frontend/src/lib/__tests__/wallLabel.test.ts`
- Modify: `components/studio/design-panel/shared.ts` (`wallTarget`), `components/studio/design-panel/WallSection.tsx:418`, `components/studio/design-panel/MontajSection.tsx:20`, `components/studio/RoomSettingsSheet.tsx:42`, `pages/studio/IsometricPage.tsx:406`

**Interfaces:**
- Produces: `wallNumber(id: string): string` — a numeric id `"0"` → `"1"`, `"3"` → `"4"`; any other id (`"A"`, `"W3"`) returned unchanged. Every user-facing wall label passes ids through it.

- [ ] **Step 1: Failing tests** — `wallNumber('0')==='1'`, `('3')==='4'`, `('A')==='A'`, `('W3')==='W3'`, `('')===''`; and a `WallSection`/target test that the chips read "Devor 1".."Devor 4" for ids 0–3 (Review Focus 1: an A–D room still reads "Devor A".."D").
- [ ] **Step 2: Run** `cd frontend && npx vitest run src/lib/__tests__/wallLabel.test.ts src/components/studio` — Expected: FAIL.
- [ ] **Step 3: Implement** and apply at the five call sites (values `{ id: wallNumber(id) }` / `{ wall: wallNumber(w.wallId) }`).
- [ ] **Step 4: Run** `npx vitest run src/lib src/components/studio src/pages/studio` — Expected: PASS (update any test asserting "Devor 0").
- [ ] **Step 5: Commit** `git commit -m "Studio: walls are numbered from 1 wherever a user reads them"`.

### Task 2: Room-first opening, flat toggle, named marks, gentler sky

**Files:**
- Modify: `lib/roomFocus.ts` (`initialRoomFocus`), `pages/studio/three-d/ThreeDCanvasScene.tsx` (focus on room change, toggle), `pages/studio/three-d/SiblingRoomLayout.tsx` (`FocusButton` label, `ActiveRoomFocusButton`, new `FlatToggle`), `lib/skyEnvironment.ts` (`skyIntensity` cap), locales `studio.three_d.*`
- Test: `lib/__tests__/roomFocus.test.ts`, `pages/studio/three-d/__tests__/SiblingRoomLayout.test.tsx`, `lib/__tests__/skyEnvironment.test.ts`

**Interfaces:**
- Produces:
  - `initialRoomFocus(search: string, roomId: string): string | null` — `null` only for `focus=0`; otherwise `roomId`.
  - `FocusButton({ focused, onClick, name, active })` — renders the bracket icon + `name` (≤16 chars + "…", full in `title`); `active` → accent fill.
  - `FlatToggle({ flat, onToggle })` — pill "Kvartira" / "Xona", `aria-pressed={flat}`.
  - `SKY_PEAK: number` and `skyIntensity(sun)` never above `SKY_PEAK` (the current sunset value, read from the existing curve).

- [ ] **Step 1: Failing tests**

```ts
it('opens focused on the active room; ?focus=0 opens the flat; ?focus=1 still focuses', ...)
it('a room mark shows its name, truncated at 16 with the full name in title; the active mark is accent', ...)
it('the flat toggle reads Kvartira when a room is focused, Xona in the flat, and reports aria-pressed', ...)
it('switching to another room re-focuses it even if the flat was showing', ...)   // Review Focus 2 (ThreeDCanvasScene effect keyed on room.id)
it('skyIntensity never exceeds SKY_PEAK across a full day', ...)
```

- [ ] **Step 2: Run** `npx vitest run src/lib src/pages/studio/three-d` — Expected: FAIL.
- [ ] **Step 3: Implement.** uz copy: "Kvartira", "Xona", "Butun kvartirani ko'rish", "Faqat shu xonani ko'rish". Toggle sits bottom-right of the canvas beside the existing round button.
- [ ] **Step 4: Run** same + `npx tsc --noEmit -p .` — Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Studio: opens on the room, a flat toggle, named room marks, a gentler sky"`.

### Task 3: Wall hover highlight and camera turn

**Files:**
- Create: `frontend/src/lib/wallFraming.ts`, `frontend/src/lib/__tests__/wallFraming.test.ts`
- Modify: `pages/studio/ThreeDPage.tsx` (`hoveredWall` state, pass down), `components/studio/design-panel/*` wall chips (`onWallHover(id|null)` on pointer enter/leave and focus/blur), `pages/studio/three-d/RoomShell.tsx` (outline when `selectedWall === id || hoveredWall === id`), `pages/studio/three-d/ThreeDCanvasScene.tsx` (camera target on `selectedWall` change via `CameraAnimator`, `version` bumped on every selection)

**Interfaces:**
- Produces: `wallFraming(walls: { id: string; a: [number, number]; b: [number, number] }[], wallId: string | null, opts: { height: number; pitchDeg?: number }): { target: [number, number, number]; position: [number, number, number] } | null` — `null` for `wallId == null` (caller falls back to the room frame) or an unknown id or an empty `walls`. Position: in front of the wall's inner face, raised to `pitchDeg` (default 35), far enough that the wall's length fills ~70 % of the view.
- Consumes: room geometry vertices → wall segments (existing helpers in `three-d/helpers.ts`).

- [ ] **Step 1: Failing tests**

```ts
// wallFraming.test.ts
it('looks at the wall middle from inside the room, 35° down', ...)       // target at segment midpoint, position on the inner normal side, elevation angle ≈ 35°
it('a longer wall puts the camera farther back', ...)
it('null for no wall, an unknown id, or no walls', ...)                  // Review Focus 4
// page/scene wiring
it('hovering a wall chip outlines that wall; leaving clears it', ...)
it('selecting a wall moves the camera there; selecting it again after the user moved the camera turns back', ...)   // Review Focus 3 (version bump)
it('Hamma devorlar returns to the room frame; reduced motion jumps instead of animating', ...)
```

- [ ] **Step 2: Run** `npx vitest run src/lib/__tests__/wallFraming.test.ts src/pages/studio` — Expected: FAIL.
- [ ] **Step 3: Implement** (animation 400 ms in `CameraAnimator`; `matchMedia('(prefers-reduced-motion: reduce)')` → duration 0). The existing cutaway already hides walls between camera and target — no change there.
- [ ] **Step 4: Run** same — Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Studio: a wall chip lights its wall and turns the camera to it"`.

### Task 4: Themed stage rail and design panel; labelled canvas buttons

**Files:**
- Modify: `pages/studio/three-d/PhaseStageNav.tsx`, `pages/studio/three-d/DesignPanelDock.tsx`, `components/studio/DesignPanel.tsx`, `components/studio/design-panel/*.tsx`, `pages/studio/three-d/ModelToolbar.tsx` (camera + lock labels), locales
- Create: `components/studio/design-panel/__tests__/theme.test.ts`

**Interfaces:**
- Consumes: tokens `card`, `card-soft`, `ink`, `ink-muted`, `line`, `accent`, `warn`, `ok`.

- [ ] **Step 1: Failing tests**

```ts
it('studio panel files use no light or raw colour classes', ...)     // scan PhaseStageNav, DesignPanelDock, DesignPanel, design-panel/*.tsx; regex as in features/mebel/ui/__tests__/theme.test.ts
it('the stage rail fills the canvas column height', ...)             // root has h-full / self-stretch
it('from md up the camera and lock buttons show "Kameralar" and "Tahrirlash: yopiq|ochiq"; on a phone they keep aria-labels', ...)
```

- [ ] **Step 2: Run** `npx vitest run src/components/studio src/pages/studio/three-d` — Expected: FAIL.
- [ ] **Step 3: Implement** the token swap (same mapping as the mebel pass: `bg-white`→`bg-card`, `bg-neutral-50/100`→`bg-card-soft`, `text-neutral-900/800/700`→`text-ink`, `text-neutral-600/500/400`→`text-ink-muted`, borders→`border-line`, blue text→`text-accent`, amber→`text-warn`, emerald→`text-ok`); done stages `text-ok` + ✓, current stage `bg-accent`-based fill. uz copy: "Kameralar", "Tahrirlash: yopiq", "Tahrirlash: ochiq".
- [ ] **Step 4: Run** `npx vitest run` and `npx tsc --noEmit -p .` — Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Studio: panels follow the theme; canvas buttons say what they do"`.

### Task 5: Shop tiles and discard behind ⋮

**Files:**
- Modify: `components/studio/design-panel/WallFloorTargetPanel.tsx`, `components/studio/design-panel/ShopPickList.tsx` (tile content), `components/studio/DesignPanel.tsx` (remove discard), `components/studio/StudioMenu.tsx` (add discard with confirm), tests beside them

**Interfaces:**
- Produces: `ShopTile({ product })` (in `design-panel/ShopTile.tsx`) — swatch from `color_hex`, else image, else the category initial; name + code/shade (`product.name_uz` already holds it; two lines max); price `t("common.price_per_unit", …)`. Used by the wall/floor/ceiling shop rows.

- [ ] **Step 1: Failing tests**

```ts
it('a shop tile shows its swatch, its name with the code, and the price per unit', ...)
it('two products with one base name are told apart by the code on their tiles', ...)
it('the design panel has no discard button; the ⋮ menu has it and asks first; cancel keeps the design', ...)
```

- [ ] **Step 2: Run** `npx vitest run src/components/studio` — Expected: FAIL.
- [ ] **Step 3: Implement.** Confirm copy: "Xona dizayni boshlang'ich holatga qaytadi. Bu amalni ortga qaytarib bo'lmaydi."
- [ ] **Step 4: Run** same — Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Studio: shop tiles show name and price; discard moves behind ⋮"`.

### Task 6: Smeta under the studio header; phone hint and stage line

**Files:**
- Modify: `pages/smeta/SmetaPage.tsx` (use the studio header component the 3D tab renders — extract it to `components/studio/StudioHeader.tsx` if it is inline), `pages/studio/ThreeDPage.tsx` (hint, stage line), `pages/smeta/SmetaPage.test.tsx`, locales
- Create: `components/studio/TapHint.tsx`, `components/studio/TapHint.test.tsx`

**Interfaces:**
- Produces: `StudioHeader({ roomName, subtitle, active: "3d" | "smeta", onBack, menu })`; `TapHint({ onDismiss })` + `useTapHintSeen(): [seen: boolean, markSeen: () => void]` (storage key `studio.tapHint.seen`, try/catch).

- [ ] **Step 1: Failing tests**

```ts
it('Smeta renders the studio header with 3D | Smeta and the room name; skeleton rows while loading', ...)
it('the phone hint shows once, closes on ×, and is remembered; storage that throws still lets it close', ...)
it('the first surface tap dismisses the hint and still opens the radial menu', ...)   // Review Focus 5
it('on a phone the header line reads "<room> · <stage>"', ...)
```

- [ ] **Step 2: Run** `npx vitest run src/pages/smeta src/components/studio src/pages/studio` — Expected: FAIL.
- [ ] **Step 3: Implement.** uz copy: "Devor, pol yoki shiftni bosing — rang va materialni tanlang."
- [ ] **Step 4: Run** `npx vitest run` and `npx tsc --noEmit -p .` — Expected: all PASS.
- [ ] **Step 5: Commit** `git commit -m "Studio: Smeta shares the header; a one-time phone hint; stage in the header"`.
