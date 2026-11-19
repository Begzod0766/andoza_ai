# Mehmon rejimi — Mobile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A first launch goes straight to Home on a silent guest session; paid/identity actions (native and inside the Studio WebView) open a "sign up" sheet; signing up keeps the rooms; a device that has had a registered sign-in still sees the login screen after logout. Ships as `1.0.3+36`.

**Architecture:** A guest is `AuthAuthenticated` whose `user.isGuest` is true — no new auth state. `AuthNotifier.startGuestSession()` calls `POST /auth/guest`; a `shared_preferences` flag `auth.hasSignedInBefore` decides login screen vs silent guest at cold start. One sheet (`showRegistrationRequiredSheet`) serves native buttons, `ApiException.code == 'registration_required'`, and the new WebView channel `AndozaAuthGate`; it opens the `LoginScreen` on a new root-navigator route `/signup`.

**Tech Stack:** Flutter, Riverpod (`StateNotifierProvider`), go_router, dio, webview_flutter, flutter_secure_storage, shared_preferences, freezed/json_serializable, flutter gen-l10n.

**Spec:** `/Users/mac/Projects/andoza_ai/.claude/worktrees/guest-spec/docs/superpowers/specs/2026-11-20-mehmon-rejimi-design.md` (in the `andoza_ai` repo) · Depends on the backend and web plans being live. Work in `/Users/mac/Projects/andoza_ai_mobile` on a branch.

## Global Constraints

- 403 contract: `{"detail": {"code": "registration_required", "feature": "<feature>", "message": "<localized>"}}` (never 401).
- Feature keys: `ai_design`, `ai_build`, `smeta_ask`, `render`, `photo_model`, `mebel_ai`, `contact`, `order`, `workshop_link`, `business`, `market_prices`.
- JSON: `user.is_guest`, `guest_merged_rooms` (login response, int or null), `prices_approximate_for_guest` (estimate).
- `POST /auth/guest` body `{"install_id": "<uuid>", "language": "uz|ru|en"}` → 201 `LoginResponse`; 503 = guest mode off, 429 = rate limit (30/h per IP, 3/day per install, 5000/day global).
- Guest refresh token 90 days (server-side); guests are deleted after 14 idle days without rooms / 100 idle days with rooms — the profile text warns about uninstalling.
- JS channel name `AndozaAuthGate`, message `{"feature": "<feature>"}`.
- Room share link is OPEN for guests.
- `auth.hasSignedInBefore` lives in `shared_preferences` (not a secret); tokens and `install_id` only in `flutter_secure_storage`. Never log request/response bodies.
- Full-screen routes (`/signup`) set `parentNavigatorKey: _rootNavigatorKey` in `lib/config/router.dart`.
- Every new string: `lib/l10n/app_uz.arb` (with `@key` description), `app_ru.arb`, `app_en.arb` together; then `flutter gen-l10n`; no hard-coded strings.
- `dart format` reflows whole files — format only the lines you touch.
- Commands: `flutter test <path>`, `flutter analyze`, `flutter gen-l10n`; `dart run build_runner build --delete-conflicting-outputs` after changing a freezed/json model.
- Commit trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- `/ai-build` is a stream: on 403 dio's `error.response.data` is a `ResponseBody`, not a `Map`, so the code would be lost → Task 1 `stream 403 carries code and feature`.
- A logged-out registered user's cold start must show `/login`, not create a guest → Task 3 `cold start after logout goes to login`.
- A failed Apple sign-in (401) while a guest must not trigger refresh-and-logout of the guest (`/auth/apple` is missing from `_authPaths` today) → Task 1 `apple 401 does not refresh`.
- After a merge the Studio WebView still holds the deleted guest's cookies → it must be re-seeded and reloaded → Task 5 `success re-seeds and reloads`.
- Offline first launch: guest creation fails → `/login` with the "continue" button, and the guest's stored `install_id` is reused on retry (no new id per launch, or the 3/day limit bites) → Task 2 `install id is stable` and Task 3 `guest failure falls back to login`.

## File Structure

- `lib/models/user_model.dart` — `User.isGuest`; `AuthResponse.guestMergedRooms`.
- `lib/services/api_client.dart` — `ApiException.code/feature`, stream error body, `_authPaths`.
- `lib/services/secure_storage.dart` — `getOrCreateInstallId()`.
- `lib/repositories/auth_repository.dart` — `startGuestSession()`.
- `lib/providers/auth_provider.dart` — `AuthNotifier.startGuestSession()`, `isGuest` extension, guest-aware `handleUnauthorized`, sign-in history marking.
- `lib/services/sign_in_history.dart` (new) — the `auth.hasSignedInBefore` flag.
- `lib/screens/splash/splash_screen.dart`, `lib/config/router.dart`, `lib/screens/auth/login_screen.dart` — cold start, `/signup`, continue-as-guest.
- `lib/widgets/registration_required_sheet.dart` (new) — the sheet + `ensureRegistered`.
- `lib/screens/studio/studio_auth_gate.dart` (new), `studio_session.dart`, `studio_webview_screen.dart`, `lib/screens/mebel/mebel_webview_screen.dart` — the channel.
- `lib/screens/studio/ai_builder_sheet.dart`, `lib/screens/masters/u5_booking_confirmation_screen.dart`, `lib/screens/shop/s6_checkout_screen.dart`, `lib/screens/app_shell.dart`, `lib/screens/business/business_screen.dart` — native pre-checks.
- `lib/screens/profile/e4_profile_settings_screen.dart`, `delete_account_dialog.dart` — guest profile.
- `lib/services/push_service.dart`, `lib/widgets/push_permission_prompt.dart`, `lib/services/session_telemetry.dart`, `lib/services/analytics_service.dart` — no push for guests, `account_type`.
- `lib/models/api/estimate.dart`, `lib/screens/estimation/e1_estimation_intro_screen.dart` — guest price note.
- `lib/l10n/app_{uz,ru,en}.arb`, `pubspec.yaml`, `docs/API.md`, `docs/ARCHITECTURE.md`.

---

### Task 1: Guest user model and API error code

**Files:** Modify `lib/models/user_model.dart`, `lib/services/api_client.dart`; Test `test/unit/guest_api_error_test.dart`, `test/unit/api_client_refresh_test.dart`

**Interfaces (Produces):**
- `User.isGuest` (`final bool isGuest`, default `false`, from `json['is_guest'] == true`).
- `AuthResponse.guestMergedRooms` (`int?`, from `json['guest_merged_rooms']`).
- `ApiException({required String message, int? statusCode, dynamic response, String? code, String? feature})`; `bool get isRegistrationRequired => statusCode == 403 && code == 'registration_required'`.
- `_handleDioError` reads `detail` when it is a `Map`: `code`, `feature`, and `message` (as the message). In `stream()`, on `DioException` whose `response.data is ResponseBody`, first read it to a string and `jsonDecode` it, then build the same exception.
- `_authPaths` adds `'/auth/apple'` and `'/auth/guest'`.

- [ ] Test:
```dart
test('User parses is_guest', () {
  expect(User.fromJson({'id': 'u', 'is_guest': true}).isGuest, isTrue);
  expect(User.fromJson({'id': 'u'}).isGuest, isFalse);
});
test('403 carries code and feature', () async {
  // _FakeAdapter answers 403 {"detail":{"code":"registration_required","feature":"render","message":"Ro'yxatdan o'ting"}}
  final e = await client.post('/render', data: {}).catchError((e) => e) as ApiException;
  expect([e.isRegistrationRequired, e.feature, e.message], [true, 'render', "Ro'yxatdan o'ting"]);
});
test('stream 403 carries code and feature', () async {
  // same body served on POST /rooms/r/ai-build with Accept: text/event-stream
  await expectLater(client.stream('/rooms/r/ai-build', data: {'prompt': 'x'}),
      emitsError(isA<ApiException>().having((e) => e.feature, 'feature', 'ai_build')));
});
test('a plain-string 403 has no code', ...);   // {"detail":"Faqat sotuvchi va administrator uchun"} → code null
// api_client_refresh_test.dart:
test('apple 401 does not refresh', ...);       // POST /auth/apple 401 with a refresh token set → no /auth/refresh call, onUnauthorized not called
test('guest 401 does not refresh', ...);       // same for /auth/guest
```
- [ ] Run `flutter test test/unit/guest_api_error_test.dart test/unit/api_client_refresh_test.dart` → fail.
- [ ] Implement. Run → pass; `flutter analyze`. Commit `feat(auth): guest flag and registration_required error`.

### Task 2: Guest session

**Files:** Modify `lib/services/secure_storage.dart`, `lib/repositories/auth_repository.dart`, `lib/providers/auth_provider.dart`; Test `test/providers/auth_provider_test.dart`, `test/unit/guest_session_test.dart`

**Interfaces:**
- `SecureStorageService.getOrCreateInstallId() -> Future<String>` (key `install_id`, a v4 UUID created once).
- `AuthRepository.startGuestSession() -> Future<AuthResponse>` — `POST /auth/guest` with `install_id` and `language`; persists tokens exactly like `login` does.
- `AuthNotifier.startGuestSession() -> Future<bool>` — `AuthAuthenticated` on success (true); `AuthInitial` on any error (false); never `AuthError` (no error UI on a silent path).
- `extension GuestAuthState on AuthState { bool get isGuest => this is AuthAuthenticated && (this as AuthAuthenticated).user.isGuest; }`
- `handleUnauthorized()`: if the dying session was a guest, after the local teardown call `startGuestSession()` (a dead guest becomes a fresh guest silently); registered → `AuthInitial` as today.

- [ ] Test (extend `_FakeAuthRepository` with `startGuestSession`; every other fake repository in `test/` that `implements AuthRepository` needs the override too):
```dart
test('startGuestSession authenticates a guest', () async {
  expect(await notifier.startGuestSession(), isTrue);
  expect(container.read(authStateProvider).isGuest, isTrue);
});
test('startGuestSession failure stays AuthInitial', () async { /* repo throws ApiException(statusCode: 503) */ expect(state, isA<AuthInitial>()); });
test('dead guest session becomes a new guest', () async { /* guest → handleUnauthorized → startGuestSession awaited once → AuthAuthenticated guest */ });
test('dead registered session goes to AuthInitial', ...);   // startGuestSession not called
test('install id is stable', () async {   // FlutterSecureStorage.setMockInitialValues({})
  expect(await storage.getOrCreateInstallId(), await storage.getOrCreateInstallId());
});
test('guest request body', ...);  // fake adapter sees POST /auth/guest {"install_id": <id>, "language": "uz"}
```
- [ ] Run → fail. Implement. Run → pass. Commit `feat(auth): silent guest session`.

### Task 3: Cold start, `/signup`, continue as guest

**Files:** Create `lib/services/sign_in_history.dart`; Modify `lib/providers/auth_provider.dart`, `lib/screens/splash/splash_screen.dart`, `lib/config/router.dart`, `lib/screens/auth/login_screen.dart`, `lib/l10n/app_{uz,ru,en}.arb`; Test `test/unit/cold_start_test.dart`, `test/unit/router_full_screen_test.dart`, `test/widget/login_guest_test.dart`

**Interfaces:**
- `class SignInHistory { Future<bool> hasSignedInBefore(); Future<void> markSignedIn(); }` (key `auth.hasSignedInBefore`); `final signInHistoryProvider = Provider<SignInHistory>(...)`.
- `AuthNotifier` calls `markSignedIn()` whenever the state becomes `AuthAuthenticated` with `!user.isGuest` (login, Google, Apple, OTP via `setSession`, register, `checkAuth`). Never cleared (logout and account deletion keep it).
- `enum ColdStart { home, login }`; `Future<ColdStart> resolveColdStart(AuthNotifier n, SignInHistory h)` — after `restoreToken()`: authenticated → `home`; else `hasSignedInBefore` → `login`; else `startGuestSession()` → `home` on true, `login` on false. Splash `_bootstrap` uses it, then `context.go('/')` (the redirect sends `login` to `/login`).
- Route `GoRoute(path: '/signup', parentNavigatorKey: _rootNavigatorKey, builder: (_, __) => const LoginScreen(fromGuest: true))`. Redirect: `/signup` allowed for a guest; a registered user there → `/`; unauthenticated there → `/login`. A guest on `/login` → `/` (unchanged rule: authenticated users leave `/login`).
- `LoginScreen({super.key, this.fromGuest = false})`. `fromGuest == false`: shows `loginContinueAsGuest` (+ `loginContinueAsGuestHint`) → `startGuestSession()`; false → snackbar `guestSessionFailed`. `fromGuest == true`: hides that button; after `setSession` → `context.pop(true)`.
- l10n: `loginContinueAsGuest` "Ro'yxatdan o'tmasdan davom etish"; `loginContinueAsGuestHint` "Xonalaringiz bu qurilmada mehmon sifatida saqlanadi."; `guestSessionFailed` "Hozir ulanib bo'lmadi. Qayta urinib ko'ring yoki tizimga kiring."

- [ ] Test:
```dart
test('fresh install becomes a guest', () async => expect(await resolveColdStart(n, history(false)), ColdStart.home)); // startGuestSession called
test('cold start after logout goes to login', () async {
  expect(await resolveColdStart(n, history(true)), ColdStart.login); expect(repo.guestCalls, 0);
});
test('cold start after account deletion goes to login', ...);  // completeAccountDeletion, then resolveColdStart → login
test('guest failure falls back to login', ...);                // history(false), repo throws → ColdStart.login
test('registered sign-in marks history, guest does not', ...);
test('/signup is on the root navigator', ...);                  // in router_full_screen_test.dart, like the other full-screen routes
testWidgets('continue as guest starts a session', ...);        // tap "Ro'yxatdan o'tmasdan davom etish" → repo.guestCalls == 1
testWidgets('fromGuest hides the continue button', ...);
```
- [ ] Run → fail. Implement; add the arb keys (uz with `@key` descriptions); `flutter gen-l10n`. Run → pass; `flutter analyze`. Commit `feat(auth): login screen only for devices that signed in before`.

### Task 4: Registration sheet and native pre-checks

**Files:** Create `lib/widgets/registration_required_sheet.dart`; Modify `lib/screens/studio/ai_builder_sheet.dart`, `lib/screens/masters/u5_booking_confirmation_screen.dart`, `lib/screens/shop/s6_checkout_screen.dart`, `lib/screens/app_shell.dart`, `lib/screens/business/business_screen.dart`, `lib/l10n/app_{uz,ru,en}.arb`; Test `test/widget/registration_sheet_test.dart`

**Interfaces:**
- `Future<bool> showRegistrationRequiredSheet(BuildContext context, {required String feature})` — title `guestSheetTitle`, feature line (`guestFeatureLabel(l10n, feature)`), body `guestSheetBody`, buttons `guestSheetSignUp` (→ `context.push<bool>('/signup')`) / `guestSheetLater`; returns true only when the user is no longer a guest afterwards.
- `Future<bool> ensureRegistered(BuildContext context, WidgetRef ref, String feature)` — true at once for a registered user; for a guest shows the sheet.
- `String guestFeatureLabel(AppLocalizations l10n, String feature)` — unknown keys fall back to `guestSheetTitle`.
- Call sites: AI builder submit (`ai_build`; also catch `ApiException.isRegistrationRequired` from the stream); booking confirm (`contact`); checkout submit (`order`); business apply entries (`business`).
- l10n: `guestSheetTitle` "Bu imkoniyat uchun ro'yxatdan o'ting"; `guestSheetBody` "Xonalaringiz saqlanib qoladi va hisobingizga o'tadi."; `guestSheetSignUp` "Ro'yxatdan o'tish"; `guestSheetLater` "Keyinroq"; `guestFeatureAiDesign` "AI dizayner"; `guestFeatureAiBuild` "AI quruvchi"; `guestFeatureRender` "Fotoreal render"; `guestFeatureSmetaAsk` "Smeta bo'yicha savol"; `guestFeatureMebelAi` "Mebel AI"; `guestFeaturePhotoModel` "Fotodan 3D model"; `guestFeatureContact` "Usta yoki do'kon bilan bog'lanish"; `guestFeatureOrder` "Buyurtma"; `guestFeatureWorkshopLink` "Ustaxona havolasi"; `guestFeatureBusiness` "Sotuvchi va usta bo'limi"; `guestFeatureMarketPrices` "Aniq bozor narxlari".

- [ ] Test:
```dart
testWidgets('guest booking opens the sheet and sends no lead', ...);  // fake masters repo: createLead not called; sheet shows "Usta yoki do'kon bilan bog'lanish"
testWidgets('registered booking sends the lead', ...);
testWidgets('Later returns false', ...);
testWidgets('sign up returns true after upgrade', ...);   // /signup stub pops true and flips the fake auth state to non-guest
testWidgets('ai builder 403 opens the sheet', ...);       // stream throws ApiException(statusCode: 403, code: 'registration_required', feature: 'ai_build')
test('every feature key has a label', () {
  for (final f in ['ai_design','ai_build','smeta_ask','render','photo_model','mebel_ai','contact','order','workshop_link','business','market_prices']) {
    expect(guestFeatureLabel(l10n, f), isNot(l10n.guestSheetTitle));
  }
});
```
- [ ] Run → fail. Implement; arb keys; `flutter gen-l10n`. Run → pass with `test/widget/business_apply_test.dart test/widget/ai_builder_style_test.dart`. Commit `feat(auth): sign-up sheet for paid and contact actions`.

### Task 5: Studio WebView bridge

**Files:** Create `lib/screens/studio/studio_auth_gate.dart`; Modify `lib/screens/studio/studio_session.dart`, `lib/screens/studio/studio_webview_screen.dart`, `lib/screens/mebel/mebel_webview_screen.dart`; Test `test/unit/studio_auth_gate_test.dart`, `test/widget/mebel_webview_test.dart`

**Interfaces:**
- `const studioAuthGateChannel = 'AndozaAuthGate';`
- `String? authGateFeatureFromMessage(String message)` — the `feature` of `{"feature": "<f>"}`, null for anything else.
- `studioAuthSeedJs(User user)` adds `'is_guest': user.isGuest` to the seeded user map.
- Both WebView screens: `..addJavaScriptChannel(studioAuthGateChannel, onMessageReceived: (m) => _onAuthGate(m.message))`; `_onAuthGate`: `showRegistrationRequiredSheet(context, feature: f)`; on true → `await seedStudioCookies(newAuth, storage)`, `await controller.runJavaScript(studioAuthSeedJs(newAuth.user))`, `await controller.reload()`.

- [ ] Test:
```dart
test('parses the feature', () {
  expect(authGateFeatureFromMessage('{"feature":"render"}'), 'render');
  expect(authGateFeatureFromMessage('open'), isNull);
  expect(authGateFeatureFromMessage('{"x":1}'), isNull);
});
test('seed carries is_guest', () {
  expect(studioAuthSeedJs(guestUser), contains(r'\"is_guest\":true'));
});
testWidgets('success re-seeds and reloads', ...);   // fake controller records runJavaScript + reload after the sheet returns true; none after false
```
- [ ] Run → fail. Implement. Run → pass with `test/unit/studio_*_test.dart`. Commit `feat(studio): AndozaAuthGate channel`.

### Task 6: Guest profile, delete guest data, merge message

**Files:** Modify `lib/screens/profile/e4_profile_settings_screen.dart`, `lib/screens/profile/delete_account_dialog.dart`, `lib/screens/auth/login_screen.dart`, `lib/l10n/app_{uz,ru,en}.arb`; Test `test/widget/profile_guest_test.dart`, `test/unit/delete_account_test.dart`

**Interfaces:**
- Guest profile: a card `profileGuestTitle` / `profileGuestBody` + button `profileGuestCta` (→ `/signup`); no account details, no `profileMenuLogout`; `profileGuestDelete` → `confirmAndDeleteAccount(context, ref, guest: true)` showing `guestDeleteConfirm` (same `POST /auth/delete-account`, no password field).
- After a successful sign-in with `guestMergedRooms > 0`: snackbar `guestMergedRooms(count)`.
- l10n: `profileGuestTitle` "Mehmon"; `profileGuestBody` "Siz ro'yxatdan o'tmagansiz. Ilovani o'chirsangiz, xonalaringiz yo'qoladi."; `profileGuestCta` "Ro'yxatdan o'tish yoki kirish"; `profileGuestDelete` "Mehmon ma'lumotlarini o'chirish"; `guestDeleteConfirm` "Barcha xonalaringiz o'chiriladi. Buni qaytarib bo'lmaydi."; `guestMergedRooms` "{count} xona akkauntingizga qo'shildi" (ICU plural, `count` int).

- [ ] Test:
```dart
testWidgets('guest profile has CTA and no logout', ...);       // finds "Ro'yxatdan o'tish yoki kirish", not l10n.profileMenuLogout
testWidgets('registered profile unchanged', ...);
testWidgets('guest delete shows the warning and no password', ...);
testWidgets('merge snackbar shows the count', ...);            // AuthResponse(guestMergedRooms: 3) → "3 xona akkauntingizga qo'shildi"
```
- [ ] Run → fail. Implement; arb; `flutter gen-l10n`. Run → pass. Commit `feat(profile): guest profile`.

### Task 7: No push for guests, `account_type`

**Files:** Modify `lib/services/push_service.dart`, `lib/widgets/push_permission_prompt.dart`, `lib/services/session_telemetry.dart`, `lib/services/analytics_service.dart`, `test/support/fake_analytics_sink.dart`; Test `test/unit/push_service_test.dart`, `test/widget/push_permission_prompt_test.dart`, `test/providers/session_telemetry_test.dart`

**Interfaces:**
- `pushRegistrationProvider.apply`: active only for `AuthAuthenticated && !user.isGuest`; guest → registered (upgrade/merge) registers then.
- `PushPermissionPrompt._maybeAsk` returns early for a guest.
- `AnalyticsSink.setUserProperty(String name, String? value)`; telemetry sets `account_type` to `guest` / `registered` (null on sign-out).

- [ ] Test:
```dart
test('guest does not register a push token', ...);   // fake push repo register count 0
test('upgrade registers once', ...);                 // guest → registered state → 1
testWidgets('no permission dialog for a guest', ...);
test('telemetry sets account_type', () { /* guest → ('account_type','guest'); registered → 'registered' */ });
```
- [ ] Run → fail. Implement. Run → pass. Commit `feat(push): skip guests; account_type property`.

### Task 8: Guest price note on the estimate

**Files:** Modify `lib/models/api/estimate.dart` (+ generated), `lib/screens/estimation/e1_estimation_intro_screen.dart`, `lib/l10n/app_{uz,ru,en}.arb`; Test `test/unit/estimate_api_test.dart`, `test/widget/estimate_guest_note_test.dart`

**Interfaces:** `@JsonKey(name: 'prices_approximate_for_guest') @Default(false) bool pricesApproximateForGuest` on the server `Estimate` model that `estimatePreviewProvider` returns; e1 shows `estimateGuestPricesNote` with a `guestSheetSignUp` link (→ `showRegistrationRequiredSheet(feature: 'market_prices')`) when true. l10n `estimateGuestPricesNote`: uz "Narxlar taxminiy. Ro'yxatdan o'tsangiz, aniqlashtiriladi." · ru "Цены ориентировочные. После регистрации они будут уточнены." · en "Prices are approximate. Sign up to get them refined."

- [ ] Test:
```dart
test('parses the flag', () {
  expect(Estimate.fromJson({...base, 'prices_approximate_for_guest': true}).pricesApproximateForGuest, isTrue);
  expect(Estimate.fromJson(base).pricesApproximateForGuest, isFalse);
});
testWidgets('note shows only with the flag', ...);
```
- [ ] Run → fail. Implement; `dart run build_runner build --delete-conflicting-outputs`; arb; `flutter gen-l10n`. Run → pass. Commit `feat(estimate): guest price note`.

### Task 9: Version, docs, full check

**Files:** Modify `pubspec.yaml` (`version: 1.0.3+36`), `docs/API.md` (`POST /auth/guest`, the 403 contract, `guest_merged_rooms`, `prices_approximate_for_guest`), `docs/ARCHITECTURE.md` (cold start, `/signup`, `AndozaAuthGate`)

- [ ] `flutter gen-l10n && flutter analyze && flutter test` → all green.
- [ ] Commit `chore: 1.0.3+36 (mehmon rejimi)`.
- [ ] Simulator QA (iPhone 17 Pro (Andoza), local backend :8001 with `GUEST_MODE_ENABLED=true` + vite :5173; Android emulator too): fresh install → no login → wizard/LiDAR → Studio autosave → smeta note + PDF note → AI designer → sheet → sign up → same room present; second run: sign in to an account with rooms → "N xona akkauntingizga qo'shildi"; guest shares a room link → opens in a browser; delete guest data; kill and reopen → still the guest; log out a registered account, kill, reopen → login screen + "continue" → guest; `GUEST_MODE_ENABLED=false` → login screen.
- [ ] Store submission notes (App Review): guest mode, which features ask for sign-up, in-app deletion of guest data.
