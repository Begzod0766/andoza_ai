# Mebel: workshop QR — a part label opens without an account

**Date:** 2026-11-04 · **Status:** approved in chat · **Area:** `/mebel/:id` labels and ⋮ menu, new public page `/d/:token`, `backend/app/routers/mebel.py`

## Why

- The mebel module prints a label for every part, with a QR code. The QR opens `/mebel/{id}?part={partId}`, which sits behind `RequireAuth`.
- The worker in the workshop who scans it has no account, so the QR shows a sign-in page. In practice the labels' QR codes do not work where they are used.
- A comparable product (detalqr.uz) is built around exactly this: scan a part, see it in 3D with its size, material and holes, no app or account.

**Success means:**

- A worker scans a label and, without signing in, sees that part within 2–3 seconds:
  - its size and material;
  - its edge banding;
  - its holes;
  - a 3D view on demand.
- The owner can revoke the link, and old labels then stop working.

## Decisions (from the brainstorm)

- **What a scan shows:** the scanned part first. From there, the other parts of the same order and each cabinet's assembly drawing are one tap away (variant A). Never prices.
- **Access:** a per-project secret token, created automatically the first time labels are printed. The owner can revoke it from the ⋮ menu (variant A).
- **Data:** live. The public endpoint returns the project's construction data, and the page computes the parts with the same engine, `computeProject` (approach 1). A part changed since its label was printed is flagged using a fingerprint carried in the QR.

## Out of scope

- Importing Bazis-Mebelshchik models.
- A shipping checklist (scan to mark a part packed).
- A client-facing 3D share link.
- Telegram sign-in.
- Editing anything from the public page.
- Offline use of the public page beyond what the PWA cache already gives.

## 1. Server

**Model.** `furniture_projects.workshop_token`:
- `String`, nullable, `UNIQUE` index;
- added by an Alembic migration.

**Owner endpoints** (auth, owner only; a project the caller does not own is a 404, as the existing mebel routes do):

| Endpoint | What it does |
|---|---|
| `POST /mebel/projects/{id}/workshop-link` | Returns `{token}`. Creates the token if the project has none, otherwise returns the existing one (idempotent). |
| `DELETE /mebel/projects/{id}/workshop-link` | Sets the token to `NULL`. Answers 204. |

**Public endpoint** (no auth): `GET /public/mebel/{token}`.

- **Rate limit:** per IP, with the same helper (`_enforce_rate_limit`, `_get_client_ip`) and limits as `GET /public/rooms/{token}`.
- **404 rule:** an empty token, a wrong token, a revoked token and a token that never existed all get the same 404 with the same body, `"Havola topilmadi"`.
- **Response, `PublicMebelProjectOut`:** an allowlist of `name` and `data`, the construction JSON as stored.
  - It carries no project id, no user id, no timestamps and no `cut_at`.
  - The construction data holds no prices or client details: those live in the price book, which is not returned.

**Token:** `secrets.token_urlsafe(24)` (about 192 bits).
- It is never derived from the project id.
- It is retried on the unlikely collision, as `room_share._generate_unique_token` does.

**Registration:**
- The owner routes go on the existing mebel router.
- The public route goes on a new `public_router`, mounted under `/api/v1` like `room_share`'s.

## 2. Labels and the ⋮ menu

**Printing labels** (`MebelProjectPage`, the labels print action):

- Before printing, the page calls `POST …/workshop-link`.
- On success, every label's QR is `${origin}/d/${token}?p=${encodeURIComponent(partId)}&v=${fingerprint}`.
- On failure, nothing prints. An error toast says the labels need a connection to make their QR codes.

**`partFingerprint(part, materialName)`** is a new pure function next to `labels.ts`. It returns 6 lowercase base-36 characters:

- It is computed from the part's finished length, finished width and thickness, the material name, the grain, the edge thickness on each side, and the holes (`kind, face, u, v, diameter, depth`, in order).
- The same part gives the same fingerprint every time.
- Changing any of those inputs changes it.

**`partLabels`** takes `token` instead of `projectId` and builds the new URL. The old `/mebel/{id}?part=` handling in `MebelProjectPage` stays, so labels already printed keep working for a signed-in owner.

**⋮ menu**

- A "Sex havolasini bekor qilish" row appears only when the project has a token.
  - To know that, the owner project response gains `has_workshop_link: bool`. The token itself is still not sent to the editor; it comes from the `POST` call.
- The row asks first, with the existing confirm dialog:
  - title "Sex havolasini bekor qilish";
  - description "Chop etilgan yorliqlardagi QR kodlar ishlamay qoladi. Keyingi chop etishda yangi havola yaratiladi.";
  - styled destructive.
- On confirm it calls `DELETE`. On failure it shows an error toast.

## 3. The worker's page, `/d/:token`

**Route**
- A top-level route outside `RequireAuth` and outside the app shell: no bottom navigation, no header menu.
- It is lazy-loaded.
- It reads the theme from the theme store and the language from the app's i18n detection.

**Data**
- `GET /public/mebel/{token}`.
- The catalogue materials for the categories the editor already loads. That catalogue is public; it is only used for material names.
- `computeProject(normalizeProject(data), EMPTY_PRICE_BOOK, catalog, [])`.
- No price book and no offcut stock: part sizes, edges and holes do not depend on either.

**Layout** (phone first, one column, theme tokens only):

1. A header: the project name, and a "Faqat ko'rish" badge.
2. **The part card** for `?p`:
   - the part's name (a free part's own name, else its role label) and its cabinet's label;
   - `L × W × T` mm;
   - the material and grain;
   - edges with `EdgeGlyph`.
3. **Holes:** `PartDrawing` and `HoleTable` for the part. A part with no holes shows a line saying so.
4. **3D:**
   - A "3D da ko'rish" button. Only the click loads `CabinetView`, which is lazy-imported.
   - It shows the part's cabinet with the part selected (`selectedPartId`).
   - Tapping another part in 3D selects it.
5. **Other parts:**
   - The order's parts grouped by cabinet label, each row showing the name and `L × W`.
   - Tapping a row selects that part and updates `?p` with `replace` (no history entry per tap).
   - Each group has an "Yig'ish chizmasi" toggle that shows `AssemblyDrawing` for that cabinet.

**Not shown:**
- prices, the BOM's costs, the summary bar;
- nesting or sheets, offcuts;
- any edit control.

**States:**

| State | What shows |
|---|---|
| Loading | Skeleton blocks |
| Bad or revoked token (404) | "Bu havola endi ishlamaydi. Loyiha egasidan yangi yorliq so'rang." |
| Other errors | "Yuklab bo'lmadi" and a retry button |
| `?p` missing or not in the project | "Bu detal loyihada endi yo'q", with the parts list. With no `?p` at all, the list alone |
| `v` given and ≠ the part's current fingerprint | Amber note "Bu detal yorliq chop etilgandan keyin o'zgargan. Quyidagi o'lchamlar — yangi." The current part shows as normal |

## Copy

- All new strings are in uz, ru and en, under `mebel.workshop.*`.
- Numbers use `intlLocale()`.

## Testing

**Backend (pytest, mocked session as `tests/test_mebel.py`):**
- **POST**
  - creates the token;
  - returns the same token when called again;
  - answers 404 for another user's project.
- **DELETE** clears the token; the next POST then gives a different one.
- **Public GET**
  - a valid token returns `name` and `data` only;
  - wrong, revoked and empty tokens give the identical 404;
  - the rate limit is applied.
- **Owner project response:** `has_workshop_link` reflects the token.

**Frontend (vitest):**
- **`partFingerprint`**
  - stable for equal input, 6 characters;
  - changes for each of length, width, thickness, material, grain, an edge and a hole.
- **`partLabels`** builds `/d/{token}?p=…&v=…`.
- **Printing labels**
  - calls the link endpoint first;
  - on failure prints nothing and shows the error.
- **⋮ menu:** the revoke row shows only with `has_workshop_link`, asks first, and calls DELETE.
- **The public page**
  - renders without auth;
  - shows the `?p` part's size, material and holes;
  - shows no price text;
  - switching parts updates `?p`;
  - 3D is not mounted until the button is pressed;
  - each of the error states above shows its text.

**Prod:**
- Print labels, then open a label's URL in an incognito window at 375 px wide, in both the day and the night theme.
- Revoke the link, and check that the URL then shows the "no longer works" state.
