# Mehmon rejimi — Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Studio inside the app works for a guest, every paid/identity button asks for registration (the native sheet in the app, `/login` on the plain website), and the smeta shows the guest price note.

**Architecture:** One small module `lib/guestGate.ts` answers "is this a guest?", "is this error the registration 403?" and "ask for registration" (JS channel `AndozaAuthGate` when embedded, `/login` otherwise). Buttons check `isGuest()` before calling, and also map a late 403 through the same helper. No route guard changes: the website still requires login and has no guest mode.

**Tech Stack:** React 18, TypeScript, zustand (`store/authStore.ts`), react-query, i18next (uz/ru/en), vitest + testing-library.

**Spec:** `docs/superpowers/specs/2026-11-20-mehmon-rejimi-design.md` · Depends on backend plan `2026-11-20-mehmon-rejimi-1-backend.md` (deployed first).

## Global Constraints

- 403 contract: `{"detail": {"code": "registration_required", "feature": "<feature>", "message": "<localized>"}}`; only `code === "registration_required"` opens the prompt — any other 403 keeps today's error handling.
- Feature keys: `ai_design`, `ai_build`, `smeta_ask`, `render`, `photo_model`, `mebel_ai`, `contact`, `order`, `workshop_link`, `business`, `market_prices` (client-only).
- JSON fields: `AuthUser.is_guest?: boolean`; `EstimateResponse.prices_approximate_for_guest?: boolean`. Missing = `false` (old app builds seed no `is_guest`).
- JS channel: `window.AndozaAuthGate.postMessage(JSON.stringify({ feature }))`.
- Room share link (`createShareLink` in `pages/studio/StudioPage.tsx`) stays OPEN for guests.
- Guest note (key `smeta.guestPricesNote`): uz "Narxlar taxminiy. Ro'yxatdan o'tsangiz, aniqlashtiriladi." · ru "Цены ориентировочные. После регистрации они будут уточнены." · en "Prices are approximate. Sign up to get them refined."
- Strings in all three `frontend/src/i18n/locales/{uz,ru,en}.json` together.
- Guest mode on the plain website is a non-goal: `RequireAuth` (`router.tsx`) and `LandingGate` are not changed.
- Setup once in the worktree: `ln -s ~/Projects/andoza_ai/frontend/node_modules frontend/node_modules`.
- Run: `cd frontend && PATH=~/.local/node/bin:$PATH npx vitest run <paths>`; types `PATH=~/.local/node/bin:$PATH npx tsc -p . --noEmit`.
- Commit trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- `aiBuildStream` throws a plain `Error(text)`, not `ApiError` → the 403 must still be recognised from `Error.message` → Task 1 `recognises the 403 inside a plain Error`.
- A non-guest 403 (e.g. photo-model "Faqat sotuvchi va administrator uchun") must not open the sign-up prompt → Task 1 `ignores other 403s` and Task 2 `PhotoToModelField keeps the seller error`.
- After a merge the app reloads the WebView with a new seeded user (`is_guest: false`); `RootLayout`'s `checkSession` must not leave a stale guest flag → Task 1 `setAuthenticated replaces is_guest`.
- Embedded mode is remembered in `sessionStorage` after in-app navigation drops `?app=1` → the prompt must still go to the channel, not `/login` → Task 1 `uses the channel after ?app=1 is gone`.
- The smeta note must not show for registered users or old responses without the field → Task 4 `no note without the flag`.

## File Structure

- `frontend/src/lib/api/auth.ts` — `AuthUser.is_guest?`.
- `frontend/src/lib/api/estimates.ts` — `EstimateResponse.prices_approximate_for_guest?`.
- `frontend/src/lib/guestGate.ts` (new) — `GuestFeature`, `isGuest`, `registrationRequiredFeature`, `requestRegistration`, `useGuestGate`.
- `frontend/src/components/studio/{AiBuilderSheet,RenderSheet,PhotoToModelField}.tsx`, `components/smeta/SmetaAskDrawer.tsx`, `features/mebel/ui/AiSuggest.tsx` — paid buttons.
- `frontend/src/pages/ustalar/UstalarPage.tsx`, `pages/dokon/DokonPage.tsx`, `pages/mebel/MebelProjectPage.tsx` — identity buttons.
- `frontend/src/pages/smeta/SmetaPage.tsx`, `i18n/locales/{uz,ru,en}.json` — guest note, market button.

---

### Task 1: `guestGate.ts` and the types

**Files:** Create `frontend/src/lib/guestGate.ts`, `frontend/src/lib/__tests__/guestGate.test.ts`; Modify `frontend/src/lib/api/auth.ts`, `frontend/src/lib/api/estimates.ts`

**Interfaces (Produces):**
```ts
export type GuestFeature = 'ai_design' | 'ai_build' | 'smeta_ask' | 'render' | 'photo_model' | 'mebel_ai'
  | 'contact' | 'order' | 'workshop_link' | 'business' | 'market_prices'
export function isGuest(): boolean                                   // useAuthStore.getState().user?.is_guest === true
export function registrationRequiredFeature(err: unknown): GuestFeature | null  // parses ApiError/Error .message as JSON
export function requestRegistration(feature: GuestFeature, navigate: (to: string, opts?: { state: unknown }) => void): void
export function useGuestGate(): { guest: boolean; gate: (feature: GuestFeature) => boolean }  // gate() → true when it prompted (caller stops)
```
`requestRegistration`: if `isEmbeddedApp()` (from `lib/embedded.tsx`) and `window.AndozaAuthGate?.postMessage` exists → post `JSON.stringify({ feature })`; else `navigate('/login', { state: { from: location.pathname + location.search + location.hash } })`. Declare `AndozaAuthGate?: { postMessage(m: string): void }` on `Window` in the same file.

- [ ] Test:
```ts
const body = JSON.stringify({ detail: { code: 'registration_required', feature: 'render', message: 'x' } })
it('recognises the ApiError 403', () => expect(registrationRequiredFeature(new ApiError(body, 403))).toBe('render'))
it('recognises the 403 inside a plain Error', () => expect(registrationRequiredFeature(new Error(body))).toBe('render'))
it('ignores other 403s', () => {
  expect(registrationRequiredFeature(new ApiError('{"detail":"Faqat sotuvchi va administrator uchun"}', 403))).toBeNull()
  expect(registrationRequiredFeature(new Error('not json'))).toBeNull()
})
it('isGuest only on true', () => { setUser({ is_guest: true }); expect(isGuest()).toBe(true); setUser({}); expect(isGuest()).toBe(false) })
it('posts to the channel when embedded', () => {
  const post = vi.fn(); window.AndozaAuthGate = { postMessage: post }; history.replaceState(null, '', '/studio/r?app=1')
  requestRegistration('render', nav); expect(post).toHaveBeenCalledWith('{"feature":"render"}'); expect(nav).not.toHaveBeenCalled()
})
it('uses the channel after ?app=1 is gone', () => { /* isEmbeddedApp('?app=1') first, then replaceState to '/smeta/r' */ })
it('goes to /login on the website', () => { delete window.AndozaAuthGate; sessionStorage.clear(); history.replaceState(null, '', '/smeta/r?x=1')
  requestRegistration('market_prices', nav); expect(nav).toHaveBeenCalledWith('/login', { state: { from: '/smeta/r?x=1' } }) })
it('setAuthenticated replaces is_guest', () => { setAuthenticated({ ...u, is_guest: true }); setAuthenticated({ ...u, is_guest: false }); expect(isGuest()).toBe(false) })
```
- [ ] Run `npx vitest run src/lib/__tests__/guestGate.test.ts` → fails (module missing).
- [ ] Implement; add the two optional fields to the types.
- [ ] Run → pass; `npx tsc -p . --noEmit` clean. Commit `feat(studio): guest gate helper`.

### Task 2: Paid Studio buttons

**Files:** Modify `frontend/src/components/studio/AiBuilderSheet.tsx`, `RenderSheet.tsx`, `PhotoToModelField.tsx`, `frontend/src/components/smeta/SmetaAskDrawer.tsx`, `frontend/src/features/mebel/ui/AiSuggest.tsx`; Test their existing `*.test.tsx` (+ `components/smeta/__tests__/SmetaAskDrawer.test.tsx` if absent)

**Interfaces:** Consumes `useGuestGate`, `registrationRequiredFeature`, `requestRegistration`. Mapping: AI designer actions (`aiDesign`, `aiDesignFromImage`, `aiDesignFromPin`) → `ai_design`; `aiBuildStream` → `ai_build`; `createRender` / `createRelight` / `createUpscale` → `render`; `createPhotoModel` → `photo_model`; `smetaAsk` → `smeta_ask`; `suggestMebelCabinets` → `mebel_ai`. In each submit handler: `if (gate('<f>')) return` before the API call; in the catch: `const f = registrationRequiredFeature(err); if (f) { requestRegistration(f, navigate); return }` before the existing error display.

- [ ] Tests (one per component, guest set in the auth store, API mocked like `RenderSheet.test.tsx`):
```ts
it('guest: render asks for registration and sends nothing', async () => {
  window.AndozaAuthGate = { postMessage: post }; markEmbedded(); asGuest()
  fireEvent.click(screen.getByRole('button', { name: /render/i }))
  expect(post).toHaveBeenCalledWith('{"feature":"render"}'); expect(createRender).not.toHaveBeenCalled()
})
it('late 403 opens the prompt instead of the error text', async () => {
  asRegistered(); createRender.mockRejectedValue(new ApiError(body403('render'), 403)) /* … */
  await waitFor(() => expect(post).toHaveBeenCalled()); expect(screen.queryByText(/registration_required/)).toBeNull()
})
it('registered user unchanged', ...)   // createRender called once
it('PhotoToModelField keeps the seller error', ...)  // ApiError('{"detail":"Faqat sotuvchi va administrator uchun"}', 403) → text shown, post not called
```
  Same three cases for `AiBuilderSheet` (AI designer prompt and the build stream — mock `aiBuildStream` to throw `new Error(body403('ai_build'))`), `SmetaAskDrawer`, `AiSuggest`.
- [ ] Run → fail. Implement. Run → pass; tsc clean. Commit `feat(studio): paid buttons ask guests to sign up`.

### Task 3: Identity buttons; share stays open

**Files:** Modify `frontend/src/pages/ustalar/UstalarPage.tsx` (`createLead` → `contact`), `frontend/src/pages/dokon/DokonPage.tsx` (`createShopInquiry` → `contact`, order/checkout → `order`), `frontend/src/pages/mebel/MebelProjectPage.tsx` (`createWorkshopLink` → `workshop_link`); Test `pages/ustalar/UstalarPage.test.tsx`, `pages/dokon/DokonPage.test.tsx`, `pages/mebel/MebelProjectPage.test.tsx`, `pages/studio/__tests__/` (share)

**Interfaces:** Same gate + late-403 pattern as Task 2. `StudioPage.tsx` `createShareLink` is not touched.

- [ ] Tests: per page, guest click → `post('{"feature":"contact"}')` (or `order` / `workshop_link`) and the API mock not called; registered → API called. Plus:
```ts
it('guest can still share a room', async () => { asGuest(); click share; expect(createShareLink).toHaveBeenCalledWith(roomId); expect(post).not.toHaveBeenCalled() })
```
- [ ] Run → fail (share test passes already — keep it as a guard). Implement. Run → pass; tsc clean. Commit `feat(web): contact, order and workshop link need registration`.

### Task 4: Smeta guest note and market button

**Files:** Modify `frontend/src/pages/smeta/SmetaPage.tsx`, `frontend/src/i18n/locales/{uz,ru,en}.json` (`smeta.guestPricesNote`, `smeta.guestSignUp`); Test `frontend/src/pages/smeta/SmetaPage.test.tsx`

**Interfaces:** Consumes `EstimateResponse.prices_approximate_for_guest`, `requestRegistration('market_prices', navigate)`. `smeta.guestSignUp`: uz "Ro'yxatdan o'tish", ru "Зарегистрироваться", en "Sign up". The note renders next to the total when the flag is `true`, with a `smeta.guestSignUp` link; the market-price button (`marketMutation`, shown when `market_prices_available`) calls `requestRegistration('market_prices', …)` for a guest instead of `previewEstimate(roomId, { market: true })`.

- [ ] Test:
```ts
it('shows the note for a guest estimate', async () => {
  previewEstimate.mockResolvedValue({ ...EST, prices_approximate_for_guest: true })
  expect(await screen.findByText("Narxlar taxminiy. Ro'yxatdan o'tsangiz, aniqlashtiriladi.")).toBeInTheDocument()
})
it('no note without the flag', async () => { previewEstimate.mockResolvedValue(EST); /* queryByText(note) is null */ })
it('guest market button asks for registration', async () => {
  asGuest(); previewEstimate.mockResolvedValue({ ...EST, market_prices_available: true, prices_approximate_for_guest: true })
  click(market button); expect(post).toHaveBeenCalledWith('{"feature":"market_prices"}')
  expect(previewEstimate).not.toHaveBeenCalledWith(expect.anything(), { market: true })
})
it('locales carry the note', () => {
  expect(ru.smeta.guestPricesNote).toBe('Цены ориентировочные. После регистрации они будут уточнены.')
  expect(en.smeta.guestPricesNote).toBe('Prices are approximate. Sign up to get them refined.')
})
```
- [ ] Run → fail. Implement. Run → pass; full `npx vitest run` and tsc clean. Commit `feat(smeta): guest price note`.

---

## Release

- [ ] Deploy (GitHub builds the image, VPS pulls) after the backend plan is live and before the mobile build is submitted. Old app builds are unaffected: they seed no `is_guest`, so `isGuest()` is false.
