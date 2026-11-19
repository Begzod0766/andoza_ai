# Mehmon rejimi — 3D Studio ro'yxatdan o'tmasdan

Sana: 2026-11-20 · Holat: dizayn (kod yo'q), egasi tasdiqlagan (2026-11-20, §8) · Yondashuv: serverdagi mehmon akkaunti

## Maqsad (egasining so'zi)

> Ilovada 3D Studio'dan foydalanishdan oldin ro'yxatdan o'tish va kirish so'raladi — bu
> foydalanish ehtimolini pasaytiradi. 3D Studio login'siz ishlasin; faqat pul turadigan API'lar
> yopiq bo'lsin. Yana qaysi funksiyalar yopiq qolishini taklif qil.

Egasi tanlagan: **mehmon ro'yxatdan o'tsa, mehmon paytida qilgan xonalari saqlanadi** (hisobga o'tadi).

## Maqsadlar

- Ilovani birinchi ochgan odam login ekranini ko'rmaydi: splash jimgina mehmon sessiyasini ochadi
  va u darhol Bosh sahifa → wizard / LiDAR → Studio (barcha bosqichlar) → smeta + PDF ga yetadi.
  Istisno: shu qurilmada avval ro'yxatdan o'tgan akkaunt bilan kirilgan bo'lsa, login ekrani ko'rsatiladi
  ("Ro'yxatdan o'tmasdan davom etish" tugmasi bilan) — §2 "Splash".
- Pul turadigan har bir endpoint mehmonga **bitta, aniq** xato qaytaradi; ilova va Studio bu xatoni
  "ro'yxatdan o'ting" oynasiga aylantiradi.
- Mehmon ro'yxatdan o'tsa yoki kirsa, xonalari yo'qolmaydi (upgrade yoki merge).
- Eski ilova buildlari (1.0.2+35 va undan oldingi) hech narsani sezmaydi.

## Maqsad emas (bu iteratsiyada)

- **Oddiy veb-saytda mehmon rejimi yo'q.** Sayt avvalgidek login talab qiladi (`RequireAuth`).
  Dizayn sayt keyinroq qo'shila oladigan qilib tuzilgan: `/auth/guest` cookie'larni ham o'rnatadi
  (`_login_response` orqali), veb esa faqat "mehmon sifatida sinab ko'rish" tugmasini qo'shishi kifoya.
- Mehmonlar uchun push-bildirishnomalar, mehmonga kvota/limitlar (xonalar soni) — keyin.
- Qurilmalararo mehmon sinxronlash (bir mehmon — bitta o'rnatish).

## Anti-maqsadlar (hech qachon bo'lmasligi kerak)

- Mehmon ro'yxatdan o'tganda yoki kirganda xonalarini yo'qotishi.
- Mehmon pul turadigan API'ga yetib borishi (kunlik byudjet ham yetmaydi: `llm.check_and_increment_budget_for`
  user_id bo'yicha hisoblaydi, mehmon esa cheksiz yangi user_id ocha oladi — shuning uchun **bloklash**, limit emas).
- Mehmon qatorlari "foydalanuvchilar" sonini shishirishi.
- Hozirgi ro'yxatdan o'tgan foydalanuvchilarning biror oqimi buzilishi. Xususan: chiqib ketgan (yoki akkauntini
  o'chirgan) ro'yxatdan o'tgan foydalanuvchi keyingi ochilishda jimgina mehmonga aylanib, "kirdim" deb o'ylab
  bir martalik akkauntda ishlab qolmasligi kerak — unga login ekrani ko'rsatiladi.
- Mehmonga narxlar aniq deb ko'rsatilishi: AI/bozor narxi o'tkazib yuborilgani ekranda va PDF'da aytiladi.

## Yondashuvlar

1. **Serverdagi mehmon akkaunti (tanlandi).** `users` qatori `is_guest=true`, oddiy JWT. Barcha
   mavjud endpointlar va egalik tekshiruvlari (`room_access.get_owned_room`: Room → Apartment.user_id)
   o'zgarmaydi. Ro'yxatdan o'tish = shu qatorni haqiqiy akkauntga aylantirish.
2. **Faqat lokal Studio, ro'yxatdan o'tganda yuklash (rad etildi).** Studio hamma narsani serverga
   saqlaydi (autosave, serverdagi smeta, PDF) — yarmini qayta yozish kerak bo'lardi, mehmon smeta olmasdi.
3. **Xonalar anonim sessiyaga tegishli (rad etildi).** Har bir egalik tekshiruvini qayta yozish kerak —
   natija bir xil, xavf ko'p.

## Pullik va identifikatsiya talab qiladigan endpointlar (egasi tasdiqlagan, 2026-11-20)

Kod bo'yicha tekshirildi: `llm.call_llm`, `ai_builder`, `ai_designer`, `smeta_ai`, `market_prices`
(Gemini + Google Search), `mebel_ai`, `myarchitect` (render), `tripo` (foto→3D) chaqiruvlari grep qilindi.

**A. Pul turadi → mehmonga yopiq** (HTTP 403 `registration_required`, ustunda `feature`):

| Endpoint | Servis (pullik tashqi API) | Mehmon | feature |
|---|---|---|---|
| `POST /rooms/{room_id}/ai-design` | `ai_designer.design_room` → `llm.call_llm` | 403 | `ai_design` |
| `POST /rooms/{room_id}/ai-design/image` | `ai_designer` + `design_image`, LLM vision, `image_design` byudjeti | 403 | `ai_design` |
| `POST /rooms/{room_id}/ai-design/pin` | `pinterest_pin` + LLM | 403 | `ai_design` |
| `POST /rooms/{room_id}/ai-build` (SSE) | `ai_builder.run_ai_builder` → LLM | 403 (stream boshlanishidan oldin) | `ai_build` |
| `POST /rooms/{room_id}/smeta/ask` | LLM (`AI_MODEL_EXPLAINER`) — **ro'yxatda yo'q edi, topildi** | 403 | `smeta_ask` |
| `POST /render` | `tasks/media.render_room_image` → MyArchitect | 403 | `render` |
| `POST /render/relight` | `relight_render` → MyArchitect | 403 | `render` |
| `POST /render/upscale` | `upscale_render` → MyArchitect — **ro'yxatda yo'q edi** | 403 | `render` |
| `POST /models/from-photo`, `GET /models/from-photo/glb` | `generate_model_from_photo` → Tripo | 403 (bugun ham `_require_model_builder` faqat sotuvchi/admin) | `photo_model` |
| `POST /mebel/ai/suggest` | `mebel_ai.suggest_cabinets` → LLM | 403 | `mebel_ai` |
| `POST /rooms/{room_id}/estimate/preview`, `POST …/estimate`, `GET …/estimate.pdf`, `GET …/estimate/pdf` | `smeta_ai.fill_ai_price_gaps` (avtomatik), `?market=true` → `market_prices` | **200**: gap-fill o'tkazib yuboriladi (qator katalog/taxminiy narxda qoladi), `market` e'tiborsiz (`market_checked=0`), javobda `prices_approximate_for_guest: true`, ekranda va PDF'da izoh (§1 "Mehmon smetasi"). Smeta va PDF ochiq | — |

Mehmon yeta olmaydigan yoki pulsiz: `furniture_style_ai` (faqat admin/sotuvchi yuklovida),
`model_optimize_queue` (lokal `glb_optimizer`, CPU), `convert_room_scan_*` (lokal), `currency.py`
(CBU kursi, bepul), `tasks/media.process_photo` (stub). `core/sms.py` — OTP SMS pul turadi, lekin bu
ro'yxatdan o'tish yo'lining o'zi; mavjud limitlar qoladi.

**B. Identifikatsiya kerak → mehmonga yopiq** (pul emas, aloqa/ishonch uchun). Usta yoki do'konga baribir
bog'lansa bo'ladigan telefon kerak, va bu ro'yxatdan o'tishning tabiiy payti:

| Endpoint | feature |
|---|---|
| `POST /leads` (usta bilan bog'lanish) | `contact` |
| `POST /shops/{store_id}/inquiries` | `contact` |
| `POST /orders` (checkout) | `order` |
| `POST /mebel/projects/{id}/workshop-link` | `workshop_link` |
| `/seller/*` (`routers/seller.py`, `shop_inquiries.seller_router`), `/usta/*`, `/usta/portfolio/*` | `business` |

**C. Mehmonga ochiq:** Studio (barcha bosqichlar, autosave, `room_state`, `finishes`, `furniture_placements`,
`electrical`, `decoration`), smeta + PDF, LiDAR/RoomPlan skan va wizard (`/rooms`, `/draft-rooms`),
**xonani ulashish havolasi** `POST /rooms/{room_id}/share`, `DELETE …/share` (o'sish uchun; murosa: mehmon
tozalansa, xonasi bilan birga havola ham ishlamay qoladi — `public/rooms/{token}` 404),
katalog va do'kon ko'rish, ustalar ro'yxati, `/user-models` (import), `POST /wallpapers` (oddiy "o'z oboyi";
mavjud moderatsiya `status` orqali o'tadi), `POST /reports` (App Store 1.2: kontentga shikoyat imkoni bo'lishi kerak),
`/mebel/projects`, `/mebel/offcuts`, `/mebel/price-book`, `/account/roles`, `/devices` (lekin ilova mehmon uchun chaqirmaydi).

## 1. Backend (`andoza_ai/backend`)

### Model va migratsiya
`app/models/user.py` → yangi ustunlar:
- `is_guest: bool` — `default=False`, `server_default="false"`, `nullable=False`; qisman indeks `WHERE is_guest`.
- `last_seen_at: datetime | None` — `/auth/guest` va `/auth/refresh` da yoziladi (tozalash uchun).
- `registered_at: datetime | None` — haqiqiy akkaunt bo'lgan payt (oddiy ro'yxat yoki upgrade). Mavjud
  qatorlar uchun `created_at` bilan to'ldiriladi. Metrikalar "ro'yxatdan o'tganlar"ni shu bo'yicha sanaydi.

Migratsiya: `alembic/versions/1786000052_users_guest_mode.py` (`down_revision = "1786000051"`).
`schemas/auth.py` `UserOut` ga `is_guest: bool = False`.

### `POST /api/v1/auth/guest`
- `async def create_guest(body: GuestCreateRequest, request: Request, response: Response, db) -> LoginResponse`, 201.
- `GuestCreateRequest`: `install_id: UUID | None`, `language: Literal["uz","ru","en"] | None`.
- `User(is_guest=True, language=…, last_seen_at=now)` — phone/username/email/google_sub/apple_sub yo'q.
- Javob `_login_response()` orqali (tokenlar body'da faqat native mijozga, cookie hammaga).
- O'chirgich: `settings.GUEST_MODE_ENABLED: bool = False` — o'chiq bo'lsa 503.
- Log: `guest_created` (faqat user_id, IP/install_id yo'q).

### Rate limit
Limiter bor: `auth._enforce_rate_limit` (Redis, get-incr-expire). Uchta kalit:
`guest_ip_rate:{ip}` — 30/soat (CGNAT: O'zbekiston mobil operatorlarida ko'p odam bitta IP'da, shuning uchun keng),
`guest_install_rate:{install_id}` — 3/kun, `guest_global_daily` — 5000/kun. 429 bo'lsa ilova login ekraniga tushadi.
**Diqqat:** `_get_client_ip` faqat `TRUST_PROXY_HEADERS=true` bo'lganda `X-Forwarded-For` ni o'qiydi (standart `false`).
Prod `.env` da yoqilmagan bo'lsa, hamma so'rov proksi IP'sidan keladi va per-IP limit (30/soat) hamma mehmonlarga
**birgalikda** qo'llanadi — 31-mehmondan keyin bir soat hech kim kira olmaydi. Shuning uchun bu flag'ni yoqishdan
oldingi majburiy qadam (§5, 3-qadam).

### `require_registered` va xato shakli
`app/api/v1/deps.py`:
- `def registered_user(feature: str) -> Callable[..., Awaitable[User]]` — `get_current_active_user` ustiga;
  `is_guest` bo'lsa ko'taradi.
- `def registration_required(request: Request, feature: str) -> HTTPException`.

Xato (mijozlar aynan shuni tekshiradi):
```
HTTP 403
{"detail": {"code": "registration_required", "feature": "<feature>", "message": "<localized matn>"}}
```
- 403, 401 emas: 401 ikkala mijozda refresh/logout siklini ishga tushiradi (`api_client.dart` refresh
  interceptor, `frontend/src/lib/api/client.ts` `handleUnauthorized`).
- `main.py` `http_exception_handler` faqat `str` detail'ni tarjima qiladi, dict'ni o'zgartirmay o'tkazadi —
  shuning uchun `message` ko'tarish paytida `i18n.messages.localized(request, …)` bilan tayyorlanadi; matn
  `i18n/messages.py` ga qo'shiladi.
- Ishlatilishi: endpointda `current_user: Annotated[User, Depends(registered_user("render"))]`; butun router
  uchun `APIRouter(..., dependencies=[Depends(registered_user("business"))])` (seller, usta, usta_portfolio,
  `seller_router`). `photo_model.py` da `registered_user` `_require_model_builder` dan **oldin** — mehmon
  "faqat sotuvchi" emas, `registration_required` oladi.
### Mehmon smetasi
- `routers/estimate.py` da `fill_ai_price_gaps` va `_with_market_prices` chaqiruvlari `current_user.is_guest`
  bo'lsa o'tkazib yuboriladi (`preview_estimate`, `create_estimate`, `_generate_estimate_pdf`). Jimgina emas:
- `schemas/estimate.py` `EstimateResponse` ga `prices_approximate_for_guest: bool = False`; chaqiruvchi mehmon
  bo'lsa doim `true` (preview, create, `GET …/estimate`). Eski mijozlar maydonni e'tiborsiz qoldiradi.
- PDF: `def _build_pdf(room, est, lang, guest_note: bool = False) -> bytes`; `_pdf_story` jami summa ostiga
  `pdf_text("smeta.guestPricesNote", lang)` qatorini qo'shadi. Kalit `frontend/src/i18n/locales/{uz,ru,en}.json`
  ga qo'shiladi va `python -m app.services.smeta_text ../frontend/src/i18n/locales` bilan
  `services/smeta_locale.json` ga ko'chiriladi (`tests/test_smeta_text.py` ikkalasi bir xilligini tekshiradi).
- Matn: uz "Narxlar taxminiy. Ro'yxatdan o'tsangiz, aniqlashtiriladi." · ru "Цены ориентировочные. После
  регистрации они будут уточнены." · en "Prices are approximate. Sign up to get them refined."

### Upgrade va merge (`routers/auth.py`)
Yangi: `async def get_guest_caller(request: Request, db) -> User | None` — cookie `token` yoki Bearer'ni o'qiydi,
faqat faol `is_guest` foydalanuvchini qaytaradi, hech qachon xato ko'tarmaydi. Mehmon bo'lmagan token e'tiborsiz
(bugungi xatti-harakat). Login route'lari hozir umuman token o'qimaydi — shu dependency qo'shiladi.

| Route | Mehmon tokeni bilan | Natija |
|---|---|---|
| `POST /auth/register` (username/parol) | doim yangi identifikator | **upgrade**: o'sha qatorga username, password_hash, name; `is_guest=False`, `registered_at=now`. 409 bo'lsa mehmon o'zgarmaydi |
| `POST /auth/otp/verify` (SMS) | telefon topilmadi | **upgrade**: `phone` o'sha qatorga |
| | telefon bor akkauntda | **merge** → o'sha akkaunt |
| `POST /auth/google` | `google_sub` topilmadi | **upgrade**: `google_sub`, email, name |
| | `google_sub` bor | **merge** |
| `POST /auth/apple` | `apple_sub` topilmadi | **upgrade**: `apple_sub`, email, name |
| | `apple_sub` bor | **merge** |
| `POST /auth/login` (username/parol) | doim mavjud akkaunt | **merge** |
| `POST /auth/refresh` | — | o'zgarmaydi; mehmonga uzunroq refresh (pastda), `last_seen_at` yoziladi |
| `POST /auth/logout` | — | o'zgarmaydi (ilova mehmonga ko'rsatmaydi) |

Email bo'yicha hech qachon bog'lanmaydi (mavjud qoida saqlanadi). Merge so'ramasdan bajariladi (egasi tasdiqlagan).
`LoginResponse` ga ixtiyoriy `guest_merged_rooms: int | None` — ilova "N xona akkauntingizga qo'shildi" deb
ko'rsatadi; eski mijozlar e'tiborsiz qoldiradi.
Servis: `app/services/guest_account.py` — `async def upgrade_guest(db, guest: User, **identity) -> User`,
`async def merge_guest_into(db, guest: User, target: User) -> MergeResult`.

### Merge algoritmi (bitta tranzaksiya)
`users.id` ga ForeignKey bo'lgan jadvallar grep qilindi. Tartib:
1. Mehmon qatorini `SELECT … FOR UPDATE`; hali `is_guest` va `guest.id != target.id` ekanini tekshirish
   (parallel ikki login: ikkinchisi oddiy login bo'lib o'tadi).
2. `apartments.user_id` → target. Xonalar (`rooms.apartment_id`) va ularning hamma bolalari (room_state,
   finishes, placements, electrical, estimates, share tokenlari) o'zi ergashadi. Mehmon yaratgan ulashish havolasi
   upgrade va merge'dan keyin ham ishlaydi (token xonada, xona id o'zgarmaydi).
3. `draft_rooms`, `furniture_projects`, `mebel_offcuts`, `media_jobs`, `room_renders` → target.
4. `user_models` → target, target'da shu `sha256` bor bo'lsa mehmonnikini tashlab ketish.
5. `price_books` (PK = user_id): target'da yo'q bo'lsa ko'chirish, bor bo'lsa mehmonnikini tashlash.
6. `content_reports`: `uq_content_reports_reporter_target` ga to'qnashmaganlarini ko'chirish.
7. `wallpapers.uploaded_by` → target.
8. `device_tokens`: mehmonnikini o'chirish (ilova yangi akkaunt uchun qayta ro'yxatga oladi).
9. Mehmonda bo'lmasligi kerak (yopiq): `orders`, `leads`, `shop_inquiries`, `stores`, `ustalar`,
   `norm_overrides` / `norm_override_log`. Ehtiyot uchun orders/leads/inquiries ham ko'chiriladi.
10. Mehmon qatorini o'chirish (qolgan narsani `ON DELETE CASCADE` oladi). Fayllar ko'chirilmaydi: storage
    kalitlari qatorlarda saqlanadi. Istisno: `render.py _require_own_render` va `photo_model.py` kalitni
    `renders/{user.id}/`, `photo-models/{user.id}/` prefiksi bilan tekshiradi — mehmon render qila olmagani uchun
    bugun muammo emas, lekin bu qoida yumshatilsa egalikni qator bo'yicha tekshirish kerak.
11. Log: `guest_merged` (sonlar bilan, PII yo'q).

### Mehmon tokenlari
`core/security.py`: `def create_refresh_token(subject: str, expires_days: int | None = None) -> str`.
Mehmonga `GUEST_REFRESH_TOKEN_EXPIRE_DAYS = 90` (oddiy 30): mehmonning yagona "paroli" — shu token.
Access token 30 daqiqa, o'zgarmaydi; refresh rotatsiyasi bugungidek.

### `/auth/me`
Mehmon uchun: `{id, phone: null, username: null, name: null, is_admin: false, language, created_at, is_guest: true}`.

### Tozalash
Celery bor (`backend/celery_app.py`), `beat` servisi `docker-compose.prod.yml` da ishlaydi, lekin
**`beat_schedule` hali umuman yo'q** — bu loyihadagi birinchi jadval bo'ladi.
- `app/tasks/maintenance.py`: `cleanup_stale_guests() -> dict`, nomi `app.tasks.maintenance.cleanup_stale_guests`,
  `default` navbat; `celery_app.py` `include` ga modul, `beat_schedule` ga `crontab(hour=4, minute=0)` (Asia/Tashkent).
- O'chiriladi: `is_guest` va `coalesce(last_seen_at, created_at)` — xonasiz bo'lsa 14 kundan, xonali bo'lsa
  100 kundan (refresh 90 kundan uzun, ya'ni qaytishi mumkin bo'lgan mehmon hech qachon o'chmaydi) eski.
- O'chirish `services/account_deletion.delete_account(db, user)` orqali (fayllar ham), 200 tadan partiyalab.

### Admin / analitika
Bugun backend'da foydalanuvchilarni sanaydigan admin endpoint yo'q (admin routerlarda `count(User)` yo'q).
Qoida: kelajakdagi har bir hisob va qo'lda yoziladigan SQL `WHERE NOT is_guest` bilan; ro'yxatdan o'tish
sanasi = `registered_at`. Loglar: `guest_created`, `guest_upgraded{method}`, `guest_merged`, `guest_cleaned`
(konversiya shulardan). Ilova: Firebase `setUserProperty("account_type", "guest"|"registered")`.

### Akkauntni o'chirish
`POST /auth/delete-account` mehmonga o'zgarishsiz ishlaydi: `password_hash` yo'q → parol so'ralmaydi,
`delete_account` hammasini o'chiradi. Ilova buni "Mehmon ma'lumotlarini o'chirish" deb ko'rsatadi.

## 2. Mobil ilova (`andoza_ai_mobile`)

- **Holat:** `models/user_model.dart` `User` ga `isGuest` (`is_guest`). `AuthAuthenticated` o'zgarmaydi; mehmon =
  `AuthAuthenticated` va `user.isGuest`. Kengaytma: `bool get isGuest` (`AuthState` ustida).
- **Sessiya:** `AuthRepository.startGuestSession()` → `POST /auth/guest` (`install_id` — secure storage'da saqlangan
  tasodifiy UUID, `language`); `AuthNotifier.startGuestSession()`. Tokenlar `flutter_secure_storage` da (`auth_token`,
  `refresh_token`), boshqa token kabi.
- **"Avval kirgan" belgisi:** `shared_preferences` (allaqachon `pubspec.yaml` da) kaliti `auth.hasSignedInBefore`
  (bool, maxfiy emas — token emas). `AuthNotifier` uni `true` qiladi har safar `AuthAuthenticated` va
  `!user.isGuest` bo'lganda (parol, OTP, Google, Apple, register, mehmonni upgrade/merge). Hech qachon `false`
  qilinmaydi (chiqish va akkauntni o'chirishda ham qoladi). Yangi: `lib/services/sign_in_history.dart` —
  `Future<bool> hasSignedInBefore()`, `Future<void> markSignedIn()`.
- **Splash** (`screens/splash/splash_screen.dart` `_bootstrap`): `restoreToken()` dan keyin hali autentifikatsiya yo'q bo'lsa:
  - `hasSignedInBefore() == true` → `/login` (jim mehmon **yo'q**), ekranda "Ro'yxatdan o'tmasdan davom etish"
    tugmasi `startGuestSession()` ni chaqiradi. Bu chiqib ketgan va akkauntini o'chirgan foydalanuvchiga ham tegishli.
  - aks holda (toza o'rnatish, bu qurilmada hech qachon ro'yxatdan o'tgan akkaunt bilan kirilmagan; mehmon o'z
    ma'lumotini o'chirgan bo'lsa ham) → jimgina `startGuestSession()`.
  - `startGuestSession()` muvaffaqiyatsiz (offline, 429, 503, eski backend 404) → `/login` bugungidek.
- **Router** (`config/router.dart`): `/login` redirect qoidasi qoladi; yangi `/signup` (o'sha `LoginScreen`,
  `fromGuest: true`, root navigator) — mehmonga ruxsat, ro'yxatdan o'tganni `/` ga qaytaradi. Sessiya o'lsa
  (`handleUnauthorized`): mehmon → `/splash` orqali yangi jim mehmon; ro'yxatdan o'tgan foydalanuvchi → `/login`
  bugungidek. `logout()` va `completeAccountDeletion()` → `/login` (belgi `true`). `LoginScreen` ga
  "Ro'yxatdan o'tmasdan davom etish" tugmasi (`fromGuest` bo'lmaganda ko'rinadi).
- **`services/api_client.dart`:** `_authPaths` ga `/auth/guest` va **`/auth/apple`** qo'shiladi (bugun yo'q!). Busiz
  mehmon tokeni bilan noto'g'ri Apple login 401 refresh+replay ni ishga tushiradi va mehmonni sessiyadan chiqarib
  yuborishi mumkin. `ApiException` ga `String? code`, `String? feature` (detail map'dan); `_extractErrorMessage`
  map ichidagi `message` ni oladi.
- **Studio ko'prigi** (`screens/studio/studio_session.dart`): `seedStudioCookies` o'zgarmaydi (mehmon tokeni oddiy
  token). `studioAuthSeedJs` user map'iga `'is_guest': user.isGuest`. `mebel_webview_screen.dart` ham shuni ishlatadi.
  `studio_webview_screen.dart` dagi `studioLoginRequired` xatosi mehmonga ko'rinmaydi (u `AuthAuthenticated`).
- **"Ro'yxatdan o'ting" oynasi:** `lib/widgets/registration_required_sheet.dart` —
  `Future<bool> showRegistrationRequiredSheet(BuildContext context, {required String feature})`. Chaqiriladi:
  (a) native tugmalarda oldindan (`isGuest`): `screens/studio/ai_builder_sheet.dart` (`/ai-build`),
  `masters/u5_booking_confirmation_screen.dart` (`/leads`), `shop/s6_checkout_screen.dart` (`/orders`), biznes bo'limi
  (`/business/apply/*`, `app_shell.dart`); (b) har qanday `ApiException.code == 'registration_required'` da;
  (c) Studio WebView'dan: yangi JS kanal **`AndozaAuthGate`** (hozir faqat `AndozaDownload`, `AndozaStudioTour` bor),
  xabar `{"feature": "<feature>"}`. Muvaffaqiyatdan keyin: `seedStudioCookies` + `studioAuthSeedJs` qayta, joriy URL
  reload (merge bo'lsa user id o'zgaradi, eski cookie 401 beradi). Oyna `/signup` ni ochadi.
- **Profil** (`screens/profile/e4_profile_settings_screen.dart`): mehmonga akkaunt ma'lumotlari o'rniga "Mehmon"
  kartasi + "Ro'yxatdan o'tish yoki kirish" CTA. "Chiqish" ko'rsatilmaydi (chiqish = xonalarni yo'qotish); o'rniga
  "Mehmon ma'lumotlarini o'chirish" (`delete_account_dialog.dart`, ogohlantirish bilan).
- **Push:** `services/push_service.dart` `pushRegistrationProvider` mehmonga `registerCurrent()` qilmaydi (bildirishnoma
  ruxsati ham so'ralmaydi); upgrade/merge'dan keyin `isGuest=false` bo'lganda ro'yxatga oladi.
- **Telemetriya:** `services/session_telemetry.dart` user id'ni bugungidek qo'yadi, plus `account_type`.
- **Smeta ekranlari** (`screens/estimation/e2_material_costs_screen.dart`, `e3_labor_costs_screen.dart`):
  `models/estimate_model.dart` ga `pricesApproximateForGuest` (`prices_approximate_for_guest`, keyin `build_runner`);
  `true` bo'lsa yuqorida kichik izoh `estimateGuestPricesNote` + "Ro'yxatdan o'tish" havolasi (sheet, feature `market_prices`).
- **Share intent** (`services/share_intent.dart`): Pinterest pin → Studio `ai_pin` → AI dizayn = pullik; mehmonga Studio
  ochiladi, AI so'rovi oynani ko'rsatadi.
- **l10n** — `app_uz.arb` (har biriga `@key` description), `app_ru.arb`, `app_en.arb` ga birga:

| Kalit | uz |
|---|---|
| `guestSheetTitle` | Bu imkoniyat uchun ro'yxatdan o'ting |
| `guestSheetBody` | Xonalaringiz saqlanib qoladi va hisobingizga o'tadi. |
| `guestSheetSignUp` | Ro'yxatdan o'tish |
| `guestSheetLater` | Keyinroq |
| `guestFeatureAiDesign` / `…AiBuild` / `…Render` / `…SmetaAsk` / `…MebelAi` | AI dizayner / AI quruvchi / Fotoreal render / Smeta bo'yicha savol / Mebel AI |
| `guestFeatureContact` / `…Order` / `…WorkshopLink` / `…Business` | Usta yoki do'kon bilan bog'lanish / Buyurtma / Ustaxona havolasi / Sotuvchi va usta bo'limi |
| `guestFeatureMarketPrices` | Aniq bozor narxlari |
| `estimateGuestPricesNote` | Narxlar taxminiy. Ro'yxatdan o'tsangiz, aniqlashtiriladi. |
| `profileGuestTitle` | Mehmon |
| `profileGuestBody` | Siz ro'yxatdan o'tmagansiz. Ilovani o'chirsangiz, xonalaringiz yo'qoladi. |
| `profileGuestCta` | Ro'yxatdan o'tish yoki kirish |
| `profileGuestDelete` | Mehmon ma'lumotlarini o'chirish |
| `guestDeleteConfirm` | Barcha xonalaringiz o'chiriladi. Buni qaytarib bo'lmaydi. |
| `guestMergedRooms` | {count} xona akkauntingizga qo'shildi (ICU plural) |
| `loginContinueAsGuest` | Ro'yxatdan o'tmasdan davom etish |
| `loginContinueAsGuestHint` | Xonalaringiz bu qurilmada mehmon sifatida saqlanadi. |

- **App Store 5.1.1(v):** akkauntga bog'liq bo'lmagan asosiy funksiya (Studio, smeta) login'siz — bu talabga mos.
  Ro'yxat oynasida Sign in with Apple saqlanadi (4.8), mehmon ma'lumotini ilova ichida o'chirish bor (5.1.1(v)
  deletion). Review notes'da mehmon rejimi va qaysi funksiyalar ro'yxat so'rashini yozish.

## 3. Veb frontend (`andoza_ai/frontend`)

- `lib/api/auth.ts` `AuthUser` ga `is_guest?: boolean`. `store/authStore.ts` o'zgarmaydi: ilova `uy-tamir-auth` ni
  `isAuthenticated: true` bilan seed qiladi, `RootLayout` `checkSession()` (`/auth/me`) dan keyin `is_guest` haqiqiy
  qiymatga yangilanadi. `RequireAuth` (`router.tsx`) o'zgarmaydi — mehmon u uchun autentifikatsiyalangan.
- Yangi `lib/guestGate.ts`: `function isGuest(): boolean`, `function isRegistrationRequired(err: unknown): string | null`
  (`ApiError.message` dagi JSON body'dan `detail.code`, `feature` qaytaradi), `function requestRegistration(feature: string): void`
  — `isEmbeddedApp()` (`lib/embedded.tsx`) va `window.AndozaAuthGate` bo'lsa `postMessage(JSON.stringify({feature}))`;
  aks holda (oddiy sayt) `/login` ga `state.from` bilan (sayt uchun web prompt).
- Pullik tugmalar: mehmon bo'lsa so'rov yubormasdan `requestRegistration`; so'rov baribir 403 `registration_required`
  qaytarsa ham xuddi shu (eskirgan holat uchun). Fayllar: `components/studio/AiBuilderSheet.tsx` (`aiDesign*`,
  `aiBuildStream`), `components/studio/RenderSheet.tsx` (`createRender/Relight/Upscale`),
  `components/studio/PhotoToModelField.tsx`, `components/smeta/SmetaAskDrawer.tsx`, `pages/smeta/SmetaPage.tsx`
  (bozor narxi tugmasi, `market: true` → feature `market_prices`), `features/mebel/ui/AiSuggest.tsx`,
  `pages/mebel/MebelProjectPage.tsx` (workshop link), `pages/ustalar/UstalarPage.tsx` (`createLead`),
  `pages/dokon/DokonPage.tsx` (inquiry/buyurtma). `pages/studio/StudioPage.tsx` dagi `createShareLink` **gate qilinmaydi**.
- `pages/smeta/SmetaPage.tsx`: `prices_approximate_for_guest` bo'lsa jami summa yonida kichik izoh
  `smeta.guestPricesNote` (o'sha kalit PDF bilan umumiy) va "Ro'yxatdan o'tish" havolasi → `requestRegistration("market_prices")`.
  `lib/api/estimates.ts` javob tipiga `prices_approximate_for_guest?: boolean`.
- Ilovadagi Studio (`?app=1`) mehmon uchun bugungidek ishlaydi; o'zgarish faqat shu tugmalarda.
- Veb barcha ilova buildlari uchun jonli: eski buildlarda `is_guest` yo'q/`false` → xatti-harakat o'zgarmaydi.

## 4. Xavflar va chekka holatlar

- **Qayta o'rnatish** — secure storage (iOS Keychain qayta o'rnatishda saqlanishi mumkin, Android'da yo'q) yo'qolsa,
  eski mehmon yetim qoladi va tozalash o'chiradi; ilova yangi mehmon ochadi. Profildagi matn buni ogohlantiradi.
- **Ikki qurilma** — har birida alohida mehmon. Ikkalasi bir akkauntga ketma-ket merge bo'ladi; xonalar qo'shiladi.
- **Mehmonning ulashish havolasi** — mehmon tozalansa (14/100 kun), xona va havola o'chadi; havolani ochgan odam 404
  ko'radi. Egasi o'sish uchun bu murosani qabul qilgan.
- **Chiqib ketgan ro'yxatdan o'tgan foydalanuvchi** — `auth.hasSignedInBefore` login ekranini ko'rsatadi. Ilova qayta
  o'rnatilsa `shared_preferences` tozalanadi → jim mehmon (bu qurilma "toza" hisoblanadi) — qabul qilinadi.
- **Xonali mehmon xonali akkauntga kiradi** — hamma apartment target'ga qo'shiladi, dublikat birlashtirilmaydi;
  ilova "N xona akkauntingizga qo'shildi" deydi.
- **Token yangilash** — mehmon refresh'i bugungidek rotatsiya qiladi; 90 kundan ko'p ochilmasa sessiya o'ladi →
  yangi mehmon. Merge'dan keyin eski mehmon tokeni 401 (qator yo'q) — ilova yangi tokenlarni saqlaydi, WebView qayta seed.
- **Parallel login / parallel merge** — merge 1-qadamidagi `FOR UPDATE` hal qiladi.
- **Suiiste'mol** — cheksiz mehmon ochish (storage: skan USDZ, import modellar, oboy). Rate limit + tozalash; kvota
  keyinroq. Pullik narsa yopiq, shuning uchun to'g'ridan-to'g'ri pul xavfi yo'q.
- **Store relizi** — mobil o'zgarish yangi build talab qiladi (hozir 1.0.2+35, keyingisi 36). Backend birinchi chiqadi
  va eski buildlar bilan mos: eski build `/auth/guest` ni chaqirmaydi, yangi maydonlar ixtiyoriy, gating faqat
  `is_guest` ga ta'sir qiladi.
- **Eski backend + yangi ilova** — `/auth/guest` 404/503 → login ekrani (bugungi oqim).

## 5. Chiqarish tartibi

1. **Backend PR** (`GUEST_MODE_ENABLED=false`): migratsiya, `/auth/guest`, `registered_user`, estimate skip, upgrade/merge,
   guest refresh TTL, `prices_approximate_for_guest` + PDF izohi, cleanup + `beat_schedule`, testlar. Deploy
   (GitHub ghcr image → VPS pull). `beat` konteyneri prod'da ishlayotganini tekshirish.
2. **Veb PR:** `is_guest`, `guestGate.ts`, tugmalar, SmetaPage izohi, `smeta.guestPricesNote` (backend
   `smeta_locale.json` bilan bir xil). Deploy.
3. **Darvoza (majburiy):** prod `.env` da `TRUST_PROXY_HEADERS=true` ekanini va `_get_client_ip` haqiqiy mijoz IP'sini
   qaytarishini tasdiqlash (masalan ikki xil tarmoqdan `/auth/guest` → log'da ikki xil IP). Sabab: aks holda hamma
   so'rov proksi IP'sidan keladi va per-IP limit barcha mehmonlarga birgalikda qo'llanadi (soatiga 30 ta mehmon butun
   mamlakat uchun). Tasdiqlanmaguncha 4-qadamga o'tilmaydi.
4. Prod `.env` da `GUEST_MODE_ENABLED=true` (hali faqat yangi ilova chaqiradi).
5. **Mobil PR:** `chore: 1.0.3+36 (mehmon rejimi)`; ikkala do'konga. Orqaga qaytarish: flag `false` → yangi ilova
   login ekraniga tushadi, mavjud mehmon tokenlari ishlashda davom etadi.

## 6. Test strategiyasi

- **Backend (pytest):** `tests/test_auth_guest.py` (yaratish, flag o'chiq → 503, rate limit 429, `/auth/me` `is_guest`,
  guest refresh TTL, `last_seen_at`); `tests/test_guest_gating.py` (A va B jadvaldagi har bir endpoint: mehmon → 403
  `registration_required` + to'g'ri `feature`; oddiy user → bu kod emas); **inventar testi** — `app.routes` ni aylanib,
  `llm`/`tripo`/`myarchitect`/`market_prices` ishlatadigan har bir route gated ro'yxatda ekanini tekshiradi (kelajakda
  ochiq qolgan pullik endpointni ushlaydi); `tests/test_guest_upgrade.py` (register/otp/google/apple upgrade — xona o'sha
  id'da; login/otp-bor/google-bor/apple-bor merge — apartmentlar ko'chdi, price_book va user_models to'qnashuvi, mehmon
  qatori yo'q, eski token 401; mehmon bo'lmagan token e'tiborsiz; mehmonning share havolasi merge'dan keyin ham 200);
  `tests/test_room_share_router.py` ga mehmon share yaratishi 201; `tests/test_estimate_router.py` ga mehmon holati
  (`fill_ai_price_gaps` chaqirilmaydi, `market` e'tiborsiz, `prices_approximate_for_guest` mehmonga `true`, oddiy
  userga `false`); `tests/test_estimate_pdf_language.py` ga PDF izohi (uch tilda, faqat mehmonga);
  `tests/test_smeta_text.py` (yangi kalit sinxron); `tests/test_guest_cleanup.py`;
  `test_celery_queues.py` ga beat jadvali; `test_account_deletion.py` ga mehmon.
- **Flutter:** `auth_provider` (mehmon sessiya, fallback), splash qarori (belgi yo'q → jim mehmon; belgi bor → `/login`;
  chiqish va akkaunt o'chirishdan keyin → `/login`; "davom etish" tugmasi → mehmon), `sign_in_history` (ro'yxatdan o'tgan
  kirish va upgrade/merge belgini qo'yadi, mehmon sessiyasi qo'ymaydi), router redirect (`/signup` mehmonga ochiq),
  `api_client` (`_authPaths`, `ApiException.code`), sheet widget testi, `studioAuthSeedJs` `is_guest`, push mehmonga
  ro'yxat qilmaydi, profil mehmon ko'rinishi, e2/e3 smeta izohi, `estimate_model` `pricesApproximateForGuest`, uchala
  `.arb` da kalitlar.
- **Veb (vitest):** `guestGate` (embedded → `postMessage`, sayt → `/login`), `RenderSheet` / `AiBuilderSheet` mehmon holati,
  `SmetaPage` (izoh faqat `prices_approximate_for_guest` da; bozor tugmasi → `market_prices`), `StudioPage` share
  mehmonga ishlaydi.
- **Simulator QA** (iPhone 17 Pro (Andoza), lokal backend :8001 + vite :5173; Android emulator ham): toza o'rnatish →
  login yo'q → wizard/LiDAR → Studio autosave → smeta + PDF → AI dizayner → oyna → ro'yxatdan o'tish → o'sha xona joyida;
  ikkinchi stsenariy: xonali akkauntga kirish → merge xabari; mehmon ma'lumotini o'chirish; ilovani yopib ochish → mehmon
  saqlangan; ro'yxatdan o'tgan akkauntdan chiqish → ilovani o'ldirib ochish → login ekrani + "davom etish" → mehmon;
  mehmon smetasi va PDF'da izoh; mehmon share havolasi brauzerda ochiladi; flag `false` → login ekrani.

## 7. Builder'ga qoldirilganlar

- `fill_ai_price_gaps` keshdagi narxni mehmonga ko'rsatish (bepul) yoki butunlay o'tkazish — hozircha butunlay o'tkaziladi.
- `/ai-build` SSE'da 403 stream ochilishidan oldin ketishini tasdiqlash (mobil `ApiClient.stream` va veb `aiBuildStream`).
- Veb `ApiError.message` = xom body; `isRegistrationRequired` JSON parse xatosiga chidamli bo'lsin.
- `PhotoToModelField` mehmonga umuman ko'rinmasligi mumkin (faqat sotuvchiga) — tekshirib, keraksiz gate qo'shmaslik.
- `docs/API.md`, `docs/ARCHITECTURE.md` (mobil) va `docs/CONFIGURATION.md` (veb: `GUEST_MODE_ENABLED`,
  `GUEST_REFRESH_TOKEN_EXPIRE_DAYS`) yangilanadi.

## 8. Qarorlar — egasi tasdiqlagan (2026-11-20)

1. Xato — **qat'iy kontrakt**: HTTP 403 `{"detail":{"code":"registration_required","feature":…,"message":…}}`.
2. Yopiq ro'yxat (A, B jadvallar) tasdiqlandi, jumladan `smeta/ask`, `render/upscale`, mebel workshop link; usta/do'kon
   bilan bog'lanish va buyurtma/checkout ro'yxat talab qiladi; seller bo'limi yopiq. `POST /reports`, `POST /wallpapers` ochiq.
3. **Xonani ulashish havolasi mehmonga ochiq** (o'sish uchun); murosa: mehmon tozalansa havola ishlamay qoladi.
4. Smeta: mehmonga AI gap-fill va bozor narxi o'tkaziladi, lekin **jimgina emas** — `prices_approximate_for_guest`
   va ekranda/PDF'da "Narxlar taxminiy. Ro'yxatdan o'tsangiz, aniqlashtiriladi" (uz/ru/en). Bozor narxi tugmasi oynani ochadi.
5. Mavjud akkauntga kirish = **so'ramasdan merge**, keyin "N xona akkauntingizga qo'shildi".
6. Qurilmada avval ro'yxatdan o'tgan akkaunt bilan kirilgan bo'lsa (`auth.hasSignedInBefore`, `shared_preferences`),
   sovuq startda login ekrani + "Ro'yxatdan o'tmasdan davom etish"; aks holda jim mehmon. Akkaunt o'chirilgandan keyin ham shunday.
7. Mehmon refresh tokeni 90 kun; tozalash: xonasiz 14 kun, xonali 100 kun harakatsiz.
8. Rate limit: IP 30/soat, install 3/kun, global 5000/kun; kill-switch `GUEST_MODE_ENABLED`. Flag'ni yoqishdan oldin
   prod `TRUST_PROXY_HEADERS` tekshiruvi — majburiy darvoza (§5).
9. Yangi ustunlar `last_seen_at`, `registered_at`; mehmonga push yo'q; profilda "Chiqish" o'rniga "Mehmon ma'lumotlarini
   o'chirish"; mehmon sessiyasi o'lsa jim yangi mehmon.
10. Faqat ilova; sayt login talab qilishda davom etadi.
11. Mobil versiya `1.0.3+36`.

Ochiq savollar: hozircha yo'q (mehmon kvotalari — "Maqsad emas" bo'limida, keyingi iteratsiya).
