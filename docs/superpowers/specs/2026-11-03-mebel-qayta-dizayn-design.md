# Mebel: list and project editor redesign

**Date:** 2026-11-03 · **Status:** approved in chat · **Area:** `/mebel` (`MebelListPage`), `/mebel/:id` (`MebelProjectPage` and `features/mebel/ui/*`)

## Why

A design critique of the two pages found these problems.

**List page**
- A card shows only the project name and a US-format timestamp with seconds. Two projects called "Oshxona" cannot be told apart.
- A red "Delete" is the loudest thing on every row.

**Editor**
- The numbers a workshop quotes from (sheets, edge banding metres, price) and the warnings are hidden inside tabs.
- Six header actions compete: two of them are coloured, and "Cut done", which cannot be undone, is one of the loudest.
- The editor is hard-coded light while the rest of the app follows the theme, so moving from the list to a project flashes white.
- The parts table repeats the material and thickness on every row and truncates the material name.
- The edges column ("2 · — · 0.4 · —") is cryptic.
- The 3D view takes a fixed third of the screen, which leaves the table, the main output, little room.

Success means:
- A workshop finds the right project from its card.
- It sees sheets, edge banding, part count, price and warnings without opening a tab.
- It reads the cut list by material.
- It sizes the 3D view to taste.
- It stays in one theme throughout.

## Decisions (from the brainstorm)

- **List cards:** show what the server already knows: cabinet and free-part counts, the "Kesildi" state with its date, and a short date. No price, no thumbnail, no migration.
- **Theme:** the editor follows the app theme in full. The cutting layout and the part and assembly drawings stay on white "paper" cards. PDF and print stay light.
- **3D view:** it stays on top, with a draggable divider. The chosen height is remembered.

## Out of scope

- The engine (parts, nesting, price).
- What the PDF, CSV and labels contain.
- Prices or thumbnails on cards.
- Sorting or searching the list.

## 1. List page (`/mebel`)

**Backend.** `GET /mebel/projects` returns `ProjectSummary` with three extra fields. No migration is needed.

| Field | Meaning |
|---|---|
| `cabinets` | `len(data.cabinets)`, or 0 if missing |
| `free_parts` | `len(data.freeParts)`, or 0 if missing (old projects have none) |
| `cut_at` | the existing column, nullable |

**Card.** Each card shows:

- the name, bold;
- a line such as "6 shkaf · 2 erkin detal". Zero counts are left out; when both counts are zero the line reads "Bo'sh";
- a green "Kesildi 02.11.2026" pill when `cut_at` is set;
- "Yangilangan: 02.11.2026 22:51", with no seconds, in the UI language's locale;
- on the right, a "⋯" menu (the do'kon `ActionMenu` moved to a shared place) with two items:
  - **Nusxa olish:** loads the project and creates `"<name> (nusxa)"` with the same `data` through the existing create endpoint, then opens the copy;
  - **O'chirish:** asks first with the existing confirm dialog, as today.

**Behaviour.**
- The whole card is a link to the project. The menu does not trigger the link.
- The "Qoldiqlar ombori" and "Yangi loyiha" buttons stay as they are.

## 2. Editor header

The header has three parts.

**Left**
- "← Loyihalar".
- The project name as an inline-editable title. Clicking it turns it into a text field; Enter or blur saves, and Escape cancels. An empty name is refused, and the old name stays.
- The "Project name" field in the left panel is removed.

**Right, in this order**
- The save state ("Saqlandi" / …).
- A ⚙ icon button labelled "Narxlar kitobi", which opens the existing price book dialog.
- The cut action:
  - "Kesildi" is a secondary button. It opens a confirm dialog: "Kesildi deb belgilansinmi? Qoldiqlar omborga yoziladi. Bu amalni ortga qaytarib bo'lmaydi."
  - After it is marked, the button is replaced by the existing green "Kesildi 02.11.2026" text.
  - The existing disabled rules stay: a failed result, cutting in progress, offcuts not loaded, or unplaced parts.
- The primary button "Eksport ▾", a menu with five items: PDF, CSV, Excel, Yorliqlar (A4), Yorliqlar (rulon). These are the existing export and print functions.

**Summary bar**

The summary bar sits under the header and is always visible when there is a result:

```
3 plita · 42.5 m kromka · 186 detal · 4 820 000 so'm · ⚠ 3
```

Each segment is a button that opens its tab:

| Segment | Opens |
|---|---|
| Sheets | Kesish xaritasi |
| Edge banding | Kromka |
| Parts | Detallar |
| Price | Material va narx |
| Warnings | Ogohlantirishlar |

- **Sheets** is the sum of the nesting sheets used, counting offcut-store pieces separately: "3 plita + 1 qoldiq".
- **Edge banding metres** is the engine's edge total.
- **Parts** is the total piece count.
- **Price** is the engine's grand total. It shows "—" when the price book is not ready.
- **Warnings** is shown only when there are warnings. It is amber.
- On a phone the bar wraps onto two lines.

## 3. 3D view and tabs

- A horizontal divider sits between the 3D view and the tab panel.
- The divider is draggable with a mouse or touch, and it is a `separator` with `aria-valuenow`, so ArrowUp/ArrowDown move it by 24 px.
- Its height is clamped to 160 px … 70 % of the viewport.
- It is stored in `localStorage` under `mebel.view3dHeight`. Every read and write is wrapped in try/catch, and the default is the current 34 vh.
- "Hide 3D" stays.
- The Warnings tab shows an amber count pill.

## 4. Parts table (`CutListTable`)

**Grouping on screen**
- Rows are grouped under a header row that spans the table: `<material name> · <thickness> mm · <N> dona`.
- Groups keep the engine's order.
- The Material and Thickness columns are hidden on screen; the group header carries them.

**Print / PDF**
- Unchanged: the group header rows are `print:hidden`, and the Material and Thickness columns are `print:table-cell`.

**Edges cell**
- It shows a 28×18 SVG rectangle with the four sides drawn: L1 top, L2 bottom, W1 left, W2 right. A banded side is a thick line coloured by band (visible / hidden); a bare side is a hairline.
- The cell's `title` and an `sr-only` text give "L1 2 mm · L2 — · W1 0.4 mm · W2 —".
- In print the cell keeps today's `edgesSummary` text.

## 5. Theme

**Follows the app theme (`bg-card`, `bg-card-soft`, `text-ink`, `text-ink-muted`, `border-line`, the existing dark tokens)**
- The editor shell and header.
- The left panel and the shared `fields.tsx` controls.
- The tabs.
- `CutListTable`, `EdgeTable`, `HoleTable`, `BomPanel` and `WarningsList`.
- `AiSuggest`, `FreePartsPanel` and `PriceBookDialog`.
- The offcut page, where it uses neutral colours.

**The 3D scene**
- The background and grid read the theme:
  - dark: background `#1b1a2b`, grid lines at 15 % white;
  - light: background `#ffffff`, as today.
- The scene re-themes when the app theme changes.

**Stays light**
- `SheetDrawing`, `PartDrawing` and `AssemblyDrawing` render on a white card with dark ink, so they read like paper in both themes.
- Print / PDF output.

**Rule:** no `bg-white`, `text-neutral-*` or `bg-neutral-*` stays in the editor files, except inside those drawing cards and `print:` variants. A test enforces it.

## 6. Copy

- All new strings in uz / ru / en.
- Dates use `intlLocale()`.

## Testing

**Backend**
- The list returns `cabinets`, `free_parts` and `cut_at`.
- A project with no `freeParts` key returns 0.

**List page**
- The counts line, including "Bo'sh".
- The "Kesildi" pill.
- The date has no seconds.
- The whole card is a link.
- The menu: Nusxa olish creates and opens a copy; O'chirish asks first.

**Header**
- Inline rename: Enter saves, Escape cancels, an empty name is refused.
- The export menu runs each export.
- "Kesildi" asks first and runs only on confirm.
- The ⚙ button opens the price book.

**Summary bar**
- Each value is right.
- Each segment opens its tab.
- The warnings segment appears only when there are warnings.
- The price shows "—" before the price book loads.

**Divider**
- Dragging and the arrow keys change the height within the clamp.
- The height is stored and restored.
- It still works when storage throws.

**Table**
- One header per material and thickness, with the piece count.
- The edges SVG title and sr-only text.
- Print classes keep the flat layout.

**Theme**
- A source scan of the editor files finds no hard-coded light classes outside the drawing cards and print variants.
- The 3D background follows the theme.

**Prod**
- Screenshots in dark and light, at desktop width and at 375 px.
