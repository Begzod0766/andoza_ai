# Mebel workshop QR Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A part label's QR opens that part (size, material, edges, holes, 3D) on a phone without an account, through a revocable per-project token.

**Architecture:**
- **Backend.** A nullable unique `workshop_token` column on `furniture_projects`, with owner endpoints to create and revoke it and one public endpoint that returns `{name, data}` for a token. This copies `room_share.py`'s token, 404 and rate-limit rules.
- **Frontend.** Labels carry `/d/{token}?p={partId}&v={fingerprint}`. A new lazy public page, `/d/:token`, recomputes the parts with `computeProject` and an empty price book, then reuses `PartDrawing`, `HoleTable`, `EdgeGlyph`, `AssemblyDrawing` and `CabinetView`.

**Tech Stack:** FastAPI, SQLAlchemy and Alembic, pytest with a stubbed session; React, react-router, TanStack Query, vitest with Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-04-mebel-sex-qr-design.md`

## Global Constraints

**Token and public endpoint**
- Token: `secrets.token_urlsafe(24)`, retried on collision. It is never derived from the project id.
- Public 404: an empty, wrong, revoked or never-existing token all get the same status and the same body, `{"detail": "Havola topilmadi"}`.
- Public rate limit: `_enforce_rate_limit`/`_get_client_ip` from `app.routers.auth`, with the same limit and window values as `room_share`'s `_PUBLIC_ROOM_IP_LIMIT` and `_PUBLIC_ROOM_IP_WINDOW`.
- Public response: exactly `name` and `data`. No id, user id, timestamps or `cut_at`.
- Owner endpoints: another user's project answers 404 `"Loyiha topilmadi"` (the existing `_own_project`).

**Labels and the public page**
- QR URL: `${origin}/d/${token}?p=${encodeURIComponent(partId)}&v=${fingerprint}`. The fingerprint is 6 lowercase base-36 characters.
- The public page never shows prices, the BOM's costs, the summary bar, nesting or sheets, offcuts, or any edit control.

**Copy, theme and git**
- New strings go in uz, ru and en, under `mebel.workshop.*`. Numbers use `intlLocale()`.
- Theme tokens only (`bg-card`, `bg-card-soft`, `text-ink`, `text-ink-muted`, `border-line`, `accent`, `warn`, `ok`). No `bg-white`, `text-neutral-*`, `bg-neutral-*`, `amber-*` or `emerald-*`.
- Commits stage named files only. Never stage `docs/partners/*`. Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

**Commands**
- Backend tests: `~/.cache/andoza-bvenv/bin/python -m pytest` (run from `backend/`).
- Frontend: `PATH=$HOME/.local/node/bin:$PATH npx vitest run` and `npx tsc --noEmit -p .` (run from `frontend/`).

## Review Focus

1. **A 429 from the rate limit, or a network error, on the public page.** It must show the retry state ("Yuklab bo'lmadi"), not "this link no longer works". Pinned in Task 5.
2. **The catalogue request fails, or a material id is not in it.** The part must still show, named by its generic material label (`t(\`mebel.material.${p.material}\`)`). Pinned in Task 5.
3. **The stored project is malformed, or the engine returns `errors`.** The page shows the retry/error state instead of crashing. Pinned in Task 5.
4. **A part id with characters needing encoding** (free-part ids, `#`, spaces). It must round-trip through `?p`. Pinned in Task 3 (URL) and Task 5 (read back).
5. **375 px with a long project name and many parts.** No horizontal overflow: names truncate. Pinned in Task 6.

---

### Task 1: Backend — the workshop token and the owner endpoints

**Files:**
- Create: `backend/alembic/versions/1786000048_mebel_workshop_token.py`
- Modify: `backend/app/models/furniture_project.py` (column), `backend/app/schemas/mebel.py` (`ProjectOut.has_workshop_link`), `backend/app/routers/mebel.py` (two routes)
- Test: `backend/tests/test_mebel_workshop.py`

**Interfaces:**
- Produces:
  - `FurnitureProject.workshop_token: Mapped[str | None]`, `String(64)`, unique index `ix_furniture_projects_workshop_token`;
  - `POST /api/v1/mebel/projects/{id}/workshop-link` → `200 {"token": str}`;
  - `DELETE /api/v1/mebel/projects/{id}/workshop-link` → `204`;
  - `ProjectOut.has_workshop_link: bool`.

- [ ] **Step 1: Write the failing tests** in `test_mebel_workshop.py`. Build the stubbed `db` and the dependency overrides exactly as `tests/test_mebel.py` does (copy its `_user`, `_Result` and client fixture pattern).

```python
def test_post_creates_a_token_for_the_owner(): ...
    # row.workshop_token is None → 200, body["token"] is a str of length >= 30, row.workshop_token == body["token"], db.commit awaited
def test_post_returns_the_existing_token():  # row.workshop_token = "tok-existing" → body == {"token": "tok-existing"}
def test_post_on_someone_elses_project_is_404():  # row.user_id != user.id → 404, detail "Loyiha topilmadi"
def test_delete_clears_the_token():  # → 204, row.workshop_token is None
def test_a_new_token_after_revoke_differs():  # POST, DELETE, POST → the two tokens differ
def test_project_out_says_whether_a_link_exists():  # GET /projects/{id}: has_workshop_link False with None, True with "tok"
```

- [ ] **Step 2: Run** `pytest tests/test_mebel_workshop.py -q`.
  Expected: FAIL (404s on the new routes, and `has_workshop_link` missing).

- [ ] **Step 3: Implement**
  - **Migration** `1786000048`, `down_revision = "1786000047"`: `add_column("furniture_projects", sa.Column("workshop_token", sa.String(64), nullable=True))` plus a unique index. The downgrade drops both.
  - **Model:** the column, `unique=True, index=True`.
  - **Schema:** `ProjectOut` gets `has_workshop_link: bool = False`. The `_count` before-validator sets `has_workshop_link = bool(get("workshop_token"))` only when `"has_workshop_link" in cls.model_fields`, so `ProjectSummary` is unchanged.
  - **Routes:** both use `_own_project`. The token helper is `_new_workshop_token(db) -> str`: loop `secrets.token_urlsafe(24)` until `select(FurnitureProject.id).where(FurnitureProject.workshop_token == t)` finds nothing (as `room_share._generate_unique_token`).
  - **Response:** the POST answers with a small schema `WorkshopLinkOut(token: str)` in `schemas/mebel.py`.

- [ ] **Step 4: Run** `pytest tests/test_mebel_workshop.py tests/test_mebel.py -q`.
  Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add backend/alembic/versions/1786000048_mebel_workshop_token.py backend/app/models/furniture_project.py backend/app/schemas/mebel.py backend/app/routers/mebel.py backend/tests/test_mebel_workshop.py
git commit -m "Mebel: a revocable workshop token per project"
```

### Task 2: Backend — the public endpoint

**Files:**
- Modify: `backend/app/routers/mebel.py` (add `public_router = APIRouter(prefix="/public/mebel")`), `backend/app/main.py` (include it under `/api/v1`, tag `"mebel"`), `backend/app/schemas/mebel.py` (`PublicMebelProjectOut`)
- Test: `backend/tests/test_mebel_workshop.py`

**Interfaces:**
- Consumes: `FurnitureProject.workshop_token` (Task 1).
- Produces: `GET /api/v1/public/mebel/{token}` → `200 {"name": str, "data": dict}`, or `404 {"detail": "Havola topilmadi"}`.

- [ ] **Step 1: Write the failing tests**

```python
def test_public_returns_name_and_data_only():  # set(body) == {"name", "data"}
def test_public_404_is_identical_for_wrong_and_revoked():  # lookup returns None → 404; status and json equal for "nope" and a revoked token
def test_public_empty_token_is_404_without_a_query():  # GET /public/mebel/%20 stripped / "" path → 404, db.execute not awaited
def test_public_is_rate_limited():  # patch app.routers.mebel._enforce_rate_limit to raise HTTPException(429) → 429
def test_public_needs_no_auth():  # no get_current_active_user override → still 200
```

- [ ] **Step 2: Run** `pytest tests/test_mebel_workshop.py -q`.
  Expected: the new tests FAIL with 404 Not Found (route missing).

- [ ] **Step 3: Implement**
  - Rate limit first, with key `f"public_mebel_ip:{ip}"` and the room-share limit and window: import `_PUBLIC_ROOM_IP_LIMIT` and `_PUBLIC_ROOM_IP_WINDOW` from `app.routers.room_share` rather than copying them.
  - Short-circuit a blank `token.strip()` to the 404.
  - Then a single equality query.
  - Return `PublicMebelProjectOut(name=row.name, data=row.data)`.

- [ ] **Step 4: Run** `pytest -q` (the whole backend).
  Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/mebel.py backend/app/main.py backend/app/schemas/mebel.py backend/tests/test_mebel_workshop.py
git commit -m "Mebel: public read-only project by workshop token"
```

### Task 3: Frontend — API calls, part fingerprint, label URL

**Files:**
- Modify: `frontend/src/lib/api/mebel.ts`, `frontend/src/features/mebel/export/labels.ts`
- Test: `frontend/src/features/mebel/export/__tests__/labels.test.tsx` (extend), `frontend/src/features/mebel/export/__tests__/fingerprint.test.ts` (new)

**Interfaces:**
- Produces:
  - `createWorkshopLink(projectId: string): Promise<{ token: string }>`;
  - `revokeWorkshopLink(projectId: string): Promise<void>`;
  - `getPublicMebelProject(token: string): Promise<{ name: string; data: FurnitureProject }>`, which uses the unauthenticated request path that `SharedRoomPage`'s API call uses;
  - `MebelProject.has_workshop_link?: boolean`;
  - `partFingerprint(part: Part, materialName: string): string`, exported from `labels.ts`;
  - `partLabels(parts, opts: { token: string; origin: string; labelOf; materialName })`. `projectId` is replaced by `token`.

- [ ] **Step 1: Write the failing tests**

```ts
it('partFingerprint is 6 base-36 chars and stable', () => { expect(partFingerprint(p, 'LDSP Oq')).toMatch(/^[0-9a-z]{6}$/); expect(partFingerprint(clone(p), 'LDSP Oq')).toBe(partFingerprint(p, 'LDSP Oq')) })
it.each(['length', 'width', 'thickness', 'material', 'grain', 'edge', 'hole'])('partFingerprint changes with %s', (what) => { expect(partFingerprint(mutate(p, what), name(what))).not.toBe(partFingerprint(p, 'LDSP Oq')) })
it('label url is /d/{token}?p={encoded id}&v={fingerprint}', () => {
  const [l] = partLabels([{ ...p, id: 'free #1' }], { token: 'tok', origin: 'https://x.uz', labelOf: () => 'A', materialName: () => 'LDSP Oq' })
  expect(l.url).toBe(`https://x.uz/d/tok?p=free%20%231&v=${partFingerprint({ ...p, id: 'free #1' }, 'LDSP Oq')}`)
})
```

`mutate` changes, in turn, `finished.length`, `finished.width`, `thickness`, the material name, `grain`, `edges.L1`, and one hole's `u`.

- [ ] **Step 2: Run** `npx vitest run src/features/mebel/export`.
  Expected: FAIL (`partFingerprint` is not exported; the url is still `/mebel/`).

- [ ] **Step 3: Implement** `partFingerprint`.
  - Build `JSON.stringify([finished.length, finished.width, thickness, materialName, grain, [L1, L2, W1, W2 thickness or null], holes.map(h => [kind, face, u, v, diameter, depth])])`.
  - Hash it with 32-bit FNV-1a.
  - Return `(h >>> 0).toString(36).padStart(6, '0').slice(-6)`.
  - Update `partLabels` and the existing label test to the token form. Add the three API functions and the field.

- [ ] **Step 4: Run** `npx vitest run src/features/mebel src/lib/api && npx tsc --noEmit -p .`.
  Expected: tests pass. tsc reports exactly one error, `MebelProjectPage`'s `projectId:` argument to `partLabels`, which Task 4 replaces.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/api/mebel.ts frontend/src/features/mebel/export/labels.ts frontend/src/features/mebel/export/__tests__/labels.test.tsx frontend/src/features/mebel/export/__tests__/fingerprint.test.ts
git commit -m "Mebel labels: workshop URL with a part fingerprint"
```

### Task 4: Editor — print through the link; revoke from the Export menu

**Files:**
- Modify: `frontend/src/pages/mebel/MebelProjectPage.tsx` (`printLabels`, the Export `ActionMenu` actions, the `LabelsPrintView` call), `frontend/src/features/mebel/useMebelProject.ts` (expose `hasWorkshopLink` and a setter or refetch), `frontend/src/i18n/locales/{uz,ru,en}.json`
- Test: `frontend/src/pages/mebel/MebelProjectPage.test.tsx`

**Interfaces:**
- Consumes: `createWorkshopLink`, `revokeWorkshopLink`, `partLabels({ token, … })`, `MebelProject.has_workshop_link` (Task 3).

- [ ] **Step 1: Write the failing tests** (mock `@/lib/api` as the file already does; `window.print` is a `vi.fn()`).

```ts
it('printing labels asks for the workshop link first, then prints with it', async () => {
  // createWorkshopLink resolves { token: 'tok' } → after choosing the A4 labels action, print called once, and the label view holds an <a> or text with '/d/tok?p='
})
it('when the link cannot be made, nothing prints and an error shows', async () => {
  // createWorkshopLink rejects → window.print not called; screen shows i18n.t('mebel.workshop.link_failed')
})
it('the revoke row shows only when the project has a link, asks first, then revokes', async () => {
  // has_workshop_link false → no row named mebel.workshop.revoke; true → row; click → confirm dialog with mebel.workshop.revoke_desc; confirm → revokeWorkshopLink('<id>') called
})
```

- [ ] **Step 2: Run** `npx vitest run src/pages/mebel/MebelProjectPage.test.tsx`.
  Expected: the 3 new tests FAIL.

- [ ] **Step 3: Implement**
  - **Printing.** `printLabels` becomes async:
    - `try { const { token } = await createWorkshopLink(id); flushSync(() => { setWorkshopToken(token); setPrinting(format) }); window.print(); setHasLink(true) } catch { toast({ variant: 'error', title: t('mebel.workshop.link_failed') }) }`;
    - `LabelsPrintView` renders only when `workshopToken` is set.
  - **Revoke.** A revoke action is appended to the Export `actions` when `hasWorkshopLink`. It runs `useConfirm`, with:
    - title `mebel.workshop.revoke`;
    - description `mebel.workshop.revoke_desc`;
    - `destructive: true`.
    - On confirm it calls `revokeWorkshopLink(id)`, clears the local flag and the token, or shows the error toast `mebel.workshop.revoke_failed`.
  - **Copy:**
    - uz:
      - `link_failed`: "Yorliqlar QR kodi uchun internet kerak — qayta urinib ko'ring.";
      - `revoke`: "Sex havolasini bekor qilish";
      - `revoke_desc`: "Chop etilgan yorliqlardagi QR kodlar ishlamay qoladi. Keyingi chop etishda yangi havola yaratiladi.";
      - `revoke_failed`: "Havolani bekor qilib bo'lmadi.".
    - ru and en: the same meaning.

- [ ] **Step 4: Run** `npx vitest run src/pages/mebel && npx tsc --noEmit -p .`.
  Expected: pass, and tsc is clean.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/mebel/MebelProjectPage.tsx frontend/src/pages/mebel/MebelProjectPage.test.tsx frontend/src/features/mebel/useMebelProject.ts frontend/src/i18n/locales/uz.json frontend/src/i18n/locales/ru.json frontend/src/i18n/locales/en.json
git commit -m "Mebel editor: labels print through the workshop link; revoke it from Export"
```

### Task 5: Public page — route, data, part card, holes, states

**Files:**
- Create: `frontend/src/pages/mebel/WorkshopPartPage.tsx`, `frontend/src/features/mebel/useWorkshopProject.ts`
- Modify: `frontend/src/router.tsx` (lazy `{ path: "/d/:token", element: withSuspense(<WorkshopPartPage />) }`, beside `/share/:token`, outside `AppShell`/`RequireAuth`), the i18n files
- Test: `frontend/src/pages/mebel/WorkshopPartPage.test.tsx`

**Interfaces:**
- Consumes: `getPublicMebelProject`, `partFingerprint`, `getCatalogMaterials` (Task 3 and existing); `computeProject`, `normalizeProject` and `EMPTY_PRICE_BOOK` from `@/features/mebel/engine`.
- Produces: `useWorkshopProject(token): { status: 'loading' | 'gone' | 'error' | 'ready'; name?: string; result?: Result; project?: FurnitureProject; materialName(p: Part): string; retry(): void }`.
  - `'gone'`: a 404.
  - `'error'`: any other failure, a malformed project, or `result.errors.length > 0`.

**Tests.** Mock `@/lib/api`. Render in `MemoryRouter` at `/d/tok?p=…&v=…`, with no auth provider.

- [ ] **Step 1: Write the failing tests**

```ts
it('opens without signing in and shows the scanned part: size, material, holes', ...)   // heading/name, "L × W × T" text, material name, HoleTable rows
it('shows no price text', ...)                                                            // queryByText(/UZS|so'm|сум/) null
it('a 404 says the link no longer works', ...)                                            // mebel.workshop.gone
it('a 429 or network error offers a retry, not "gone"', ...)                              // mebel.workshop.load_failed + retry button calls the API again
it('a part not in the project says so', ...)                                              // ?p=nope → mebel.workshop.part_missing
it('a changed part is flagged; an unchanged one is not', ...)                             // v=zzzzzz → mebel.workshop.changed; v=<real fingerprint> → absent
it('a material the catalogue does not know still shows its generic name', ...)            // getCatalogMaterials rejects → t('mebel.material.board') text present
it('a malformed project shows the error state, not a crash', ...)                         // data: {} → mebel.workshop.load_failed
it('an encoded part id is read back', ...)                                                // ?p=free%20%231 selects part id 'free #1'
```

- [ ] **Step 2: Run** `npx vitest run src/pages/mebel/WorkshopPartPage.test.tsx`.
  Expected: FAIL (module not found).

- [ ] **Step 3: Implement** the hook and the page.
  - **Data and layout:**
    - The page header shows the project name, truncated, and a `mebel.workshop.read_only` badge.
    - The card shows:
      - the name: a free part's `name`, else `t(\`mebel.role.${role}\`)` or the existing role-label helper used by `CutListTable`;
      - the cabinet label;
      - `L × W × T mm` with `intlLocale()` number formatting;
      - the material and grain;
      - `<EdgeGlyph edges>`.
    - Then `<PartDrawing part>` and `<HoleTable part>`. A part with no holes shows `mebel.workshop.no_holes` instead.
  - **States:**
    - a skeleton while loading;
    - the `gone`, `error`, `part_missing` and `changed` copy per the spec;
    - with no `?p`, the list placeholder.
  - **Copy:**
    - uz:
      - `read_only`: "Faqat ko'rish";
      - `gone`: "Bu havola endi ishlamaydi. Loyiha egasidan yangi yorliq so'rang.";
      - `load_failed`: "Yuklab bo'lmadi";
      - `retry`: "Qayta urinish";
      - `part_missing`: "Bu detal loyihada endi yo'q";
      - `changed`: "Bu detal yorliq chop etilgandan keyin o'zgargan. Quyidagi o'lchamlar — yangi.";
      - `no_holes`: "Bu detalda teshik yo'q".
    - ru and en: the same meaning.

- [ ] **Step 4: Run** `npx vitest run src/pages/mebel && npx tsc --noEmit -p .`.
  Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/mebel/WorkshopPartPage.tsx frontend/src/pages/mebel/WorkshopPartPage.test.tsx frontend/src/features/mebel/useWorkshopProject.ts frontend/src/router.tsx frontend/src/i18n/locales/uz.json frontend/src/i18n/locales/ru.json frontend/src/i18n/locales/en.json
git commit -m "Workshop page: a scanned part opens without an account"
```

### Task 6: Public page — other parts, assembly drawing, 3D on demand

**Files:**
- Modify: `frontend/src/pages/mebel/WorkshopPartPage.tsx`, the i18n files
- Test: `frontend/src/pages/mebel/WorkshopPartPage.test.tsx`; also add the page to the mebel theme scan's file list if that test enumerates files

**Interfaces:**
- Consumes: Task 5's hook and page; `AssemblyDrawing({ label, parts })`; `CabinetView({ parts, selectedPartId, onSelect })`, lazy-imported from `@/features/mebel/three/CabinetView`.

- [ ] **Step 1: Write the failing tests**

```ts
it('lists the order\'s parts by cabinet; tapping one selects it and replaces ?p', ...)    // location.search after click has p=<other id>; history length unchanged (use a router with a location probe)
it('each cabinet group opens its assembly drawing', ...)                                  // button mebel.workshop.assembly → AssemblyDrawing content (its testid/role) appears
it('3D is not loaded until asked for', ...)                                               // vi.mock CabinetView module with a spy component; not rendered before clicking mebel.workshop.view_3d; rendered with selectedPartId after
it('a long name and many parts do not widen the page', ...)                               // the header name element has class truncate; list rows have min-w-0 + truncate
```

- [ ] **Step 2: Run** `npx vitest run src/pages/mebel/WorkshopPartPage.test.tsx`.
  Expected: the 4 new tests FAIL.

- [ ] **Step 3: Implement**
  - **Parts list.** Group with `labelOf(cabinetId)`, which is a cabinet's `label`, else a free part's label, as in the editor's `labelOf`.
  - **Rows.** Selecting a row calls `setSearchParams({ p: id }, { replace: true })`. This drops `v`: the fingerprint check is for the scanned part only.
  - **3D.** It shows the selected part's cabinet's parts only, in an `h-72` box. Tapping another part selects it the same way.
  - **Copy:**
    - uz:
      - `other_parts`: "Buyurtmadagi boshqa detallar";
      - `assembly`: "Yig'ish chizmasi";
      - `view_3d`: "3D da ko'rish".
    - ru and en: the same meaning.

- [ ] **Step 4: Run the whole frontend:** `npx vitest run && npx tsc --noEmit -p .`.
  Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/mebel/WorkshopPartPage.tsx frontend/src/pages/mebel/WorkshopPartPage.test.tsx frontend/src/i18n/locales/uz.json frontend/src/i18n/locales/ru.json frontend/src/i18n/locales/en.json
git commit -m "Workshop page: other parts, assembly drawings, 3D on demand"
```
