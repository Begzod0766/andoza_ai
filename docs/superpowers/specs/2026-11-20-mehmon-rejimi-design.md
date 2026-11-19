# Mehmon rejimi — 3D Studio ro'yxatdan o'tmasdan

Sana: 2026-11-20 · Holat: dizayn (kod yo'q) · Yondashuv: serverdagi mehmon akkaunti (egasi tasdiqlagan)

## Maqsad (egasining so'zi)

> Ilovada 3D Studio'dan foydalanishdan oldin ro'yxatdan o'tish va kirish so'raladi — bu
> foydalanish ehtimolini pasaytiradi. 3D Studio login'siz ishlasin; faqat pul turadigan API'lar
> yopiq bo'lsin. Yana qaysi funksiyalar yopiq qolishini taklif qil.

Egasi tanlagan: **mehmon ro'yxatdan o'tsa, mehmon paytida qilgan xonalari saqlanadi** (hisobga o'tadi).

## Maqsadlar

- Ilovani birinchi ochgan odam login ekranini ko'rmaydi: splash jimgina mehmon sessiyasini ochadi
  va u darhol Bosh sahifa → wizard / LiDAR → Studio (barcha bosqichlar) → smeta + PDF ga yetadi.
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
- Hozirgi ro'yxatdan o'tgan foydalanuvchilarning biror oqimi buzilishi.

## Yondashuvlar

1. **Serverdagi mehmon akkaunti (tanlandi).** `users` qatori `is_guest=true`, oddiy JWT. Barcha
   mavjud endpointlar va egalik tekshiruvlari (`room_access.get_owned_room`: Room → Apartment.user_id)
   o'zgarmaydi. Ro'yxatdan o'tish = shu qatorni haqiqiy akkauntga aylantirish.
2. **Faqat lokal Studio, ro'yxatdan o'tganda yuklash (rad etildi).** Studio hamma narsani serverga
   saqlaydi (autosave, serverdagi smeta, PDF) — yarmini qayta yozish kerak bo'lardi, mehmon smeta olmasdi.
3. **Xonalar anonim sessiyaga tegishli (rad etildi).** Har bir egalik tekshiruvini qayta yozish kerak —
   natija bir xil, xavf ko'p.

## Pullik va identifikatsiya talab qiladigan endpointlar (TAKLIF — egasi bandma-band tasdiqlamagan)

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
| `POST /rooms/{room_id}/estimate/preview`, `POST …/estimate`, `GET …/estimate.pdf`, `GET …/estimate/pdf` | `smeta_ai.fill_ai_price_gaps` (avtomatik), `?market=true` → `market_prices` | **200**: gap-fill o'tkazib yuboriladi (qator katalog/taxminiy narxda qoladi), `market` e'tiborsiz (`market_checked=0`). Smeta va PDF ochiq | — |

Mehmon yeta olmaydigan yoki pulsiz: `furniture_style_ai` (faqat admin/sotuvchi yuklovida),
`model_optimize_queue` (lokal `glb_optimizer`, CPU), `convert_room_scan_*` (lokal), `currency.py`
(CBU kursi, bepul), `tasks/media.process_photo` (stub). `core/sms.py` — OTP SMS pul turadi, lekin bu
ro'yxatdan o'tish yo'lining o'zi; mavjud limitlar qoladi.

**B. Identifikatsiya kerak → mehmonga yopiq** (pul emas, aloqa/ishonch uchun):

| Endpoint | feature |
|---|---|
| `POST /leads` (usta bilan bog'lanish) | `contact` |
| `POST /shops/{store_id}/inquiries` | `contact` |
| `POST /orders` | `order` |
| `POST /rooms/{room_id}/share`, `DELETE …/share` | `share` |
| `POST /mebel/projects/{id}/workshop-link` — **mening qo'shimcham** (bu ham ulashish havolasi) | `share` |
| `/seller/*` (`routers/seller.py`, `shop_inquiries.seller_router`), `/usta/*`, `/usta/portfolio/*` | `business` |

**C. Mehmonga ochiq:** Studio (barcha bosqichlar, autosave, `room_state`, `finishes`, `furniture_placements`,
`electrical`, `decoration`), smeta + PDF, LiDAR/RoomPlan skan va wizard (`/rooms`, `/draft-rooms`),
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
Prod `.env` da yoqilmagan bo'lsa, per-IP limit amalda global bo'lib qoladi — builder tekshiradi.

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
- Smeta: `routers/estimate.py` da `fill_ai_price_gaps` va `_with_market_prices` chaqiruvlari
  `current_user.is_guest` bo'lsa o'tkazib yuboriladi (`preview_estimate`, `create_estimate`, `_generate_estimate_pdf`).

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

Email bo'yicha hech qachon bog'lanmaydi (mavjud qoida saqlanadi). `LoginResponse` ga ixtiyoriy
`guest_merged_rooms: int | None` — ilova "N ta xona hisobingizga ko'chirildi" deb ko'rsatadi; eski mijozlar e'tiborsiz qoldiradi.
Servis: `app/services/guest_account.py` — `async def upgrade_guest(db, guest: User, **identity) -> User`,
`async def merge_guest_into(db, guest: User, target: User) -> MergeResult`.

### Merge algoritmi (bitta tranzaksiya)
`users.id` ga ForeignKey bo'lgan jadvallar grep qilindi. Tartib:
1. Mehmon qatorini `SELECT … FOR UPDATE`; hali `is_guest` va `guest.id != target.id` ekanini tekshirish
   (parallel ikki login: ikkinchisi oddiy login bo'lib o'tadi).
2. `apartments.user_id` → target. Xonalar (`rooms.apartment_id`) va ularning hamma bolalari (room_state,
   finishes, placements, electrical, estimates, share tokenlari) o'zi ergashadi.
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
- **Splash** (`screens/splash/splash_screen.dart` `_bootstrap`): `restoreToken()` dan keyin hali autentifikatsiya yo'q
  bo'lsa → `startGuestSession()`. Muvaffaqiyatsiz (offline, 429, 503, eski backend 404) → `/login` bugungidek.
- **Router** (`config/router.dart`): `/login` redirect qoidasi qoladi; yangi `/signup` (o'sha `LoginScreen`,
  `fromGuest: true`, root navigator) — mehmonga ruxsat, ro'yxatdan o'tganni `/` ga qaytaradi. Mehmon `/login` ga
  tushsa (`handleUnauthorized` — o'lik sessiya) → `/splash` orqali yangi mehmon; ro'yxatdan o'tgan foydalanuvchi
  bugungidek `/login` ga. `LoginScreen` ga "Ro'yxatdan o'tmasdan davom etish" tugmasi (fallback holat uchun).
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
| `guestFeatureContact` / `…Order` / `…Share` / `…Business` | Usta yoki do'kon bilan bog'lanish / Buyurtma / Ulashish / Sotuvchi va usta bo'limi |
| `profileGuestTitle` | Mehmon |
| `profileGuestBody` | Siz ro'yxatdan o'tmagansiz. Ilovani o'chirsangiz, xonalaringiz yo'qoladi. |
| `profileGuestCta` | Ro'yxatdan o'tish yoki kirish |
| `profileGuestDelete` | Mehmon ma'lumotlarini o'chirish |
| `guestDeleteConfirm` | Barcha xonalaringiz o'chiriladi. Buni qaytarib bo'lmaydi. |
| `guestMergedRooms` | {count} ta xona hisobingizga ko'chirildi (ICU plural) |
| `loginContinueAsGuest` | Ro'yxatdan o'tmasdan davom etish |

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
  (bozor narxi tugmasi, `market: true`), `features/mebel/ui/AiSuggest.tsx`, `pages/mebel/MebelProjectPage.tsx`
  (workshop link), `pages/studio/StudioPage.tsx` (`createShareLink`), `pages/ustalar/UstalarPage.tsx` (`createLead`),
  `pages/dokon/DokonPage.tsx` (inquiry/buyurtma).
- Ilovadagi Studio (`?app=1`) mehmon uchun bugungidek ishlaydi; o'zgarish faqat shu tugmalarda.
- Veb barcha ilova buildlari uchun jonli: eski buildlarda `is_guest` yo'q/`false` → xatti-harakat o'zgarmaydi.

## 4. Xavflar va chekka holatlar

- **Qayta o'rnatish** — secure storage (iOS Keychain qayta o'rnatishda saqlanishi mumkin, Android'da yo'q) yo'qolsa,
  eski mehmon yetim qoladi va tozalash o'chiradi; ilova yangi mehmon ochadi. Profildagi matn buni ogohlantiradi.
- **Ikki qurilma** — har birida alohida mehmon. Ikkalasi bir akkauntga ketma-ket merge bo'ladi; xonalar qo'shiladi.
- **Xonali mehmon xonali akkauntga kiradi** — hamma apartment target'ga qo'shiladi, dublikat birlashtirilmaydi;
  ilova "N ta xona ko'chirildi" deydi.
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
   guest refresh TTL, cleanup + `beat_schedule`, testlar. Deploy (GitHub ghcr image → VPS pull). `TRUST_PROXY_HEADERS`
   va `beat` konteynerini prod'da tekshirish.
2. **Veb PR:** `is_guest`, `guestGate.ts`, tugmalar. Deploy.
3. Prod `.env` da `GUEST_MODE_ENABLED=true` (hali faqat yangi ilova chaqiradi).
4. **Mobil PR:** `chore: 1.0.3+36 (mehmon rejimi)`; ikkala do'konga. Orqaga qaytarish: flag `false` → yangi ilova
   login ekraniga tushadi, mavjud mehmon tokenlari ishlashda davom etadi.

## 6. Test strategiyasi

- **Backend (pytest):** `tests/test_auth_guest.py` (yaratish, flag o'chiq → 503, rate limit 429, `/auth/me` `is_guest`,
  guest refresh TTL, `last_seen_at`); `tests/test_guest_gating.py` (A va B jadvaldagi har bir endpoint: mehmon → 403
  `registration_required` + to'g'ri `feature`; oddiy user → bu kod emas); **inventar testi** — `app.routes` ni aylanib,
  `llm`/`tripo`/`myarchitect`/`market_prices` ishlatadigan har bir route gated ro'yxatda ekanini tekshiradi (kelajakda
  ochiq qolgan pullik endpointni ushlaydi); `tests/test_guest_upgrade.py` (register/otp/google/apple upgrade — xona o'sha
  id'da; login/otp-bor/google-bor/apple-bor merge — apartmentlar ko'chdi, price_book va user_models to'qnashuvi, mehmon
  qatori yo'q, eski token 401; mehmon bo'lmagan token e'tiborsiz); `tests/test_estimate_router.py` ga mehmon holati
  (`fill_ai_price_gaps` chaqirilmaydi, `market` e'tiborsiz, PDF 200); `tests/test_guest_cleanup.py`;
  `test_celery_queues.py` ga beat jadvali; `test_account_deletion.py` ga mehmon.
- **Flutter:** `auth_provider` (mehmon sessiya, fallback), router redirect (`/signup` mehmonga ochiq), `api_client`
  (`_authPaths`, `ApiException.code`), sheet widget testi, `studioAuthSeedJs` `is_guest`, push mehmonga ro'yxat qilmaydi,
  profil mehmon ko'rinishi, uchala `.arb` da kalitlar.
- **Veb (vitest):** `guestGate` (embedded → `postMessage`, sayt → `/login`), `RenderSheet` / `AiBuilderSheet` / `SmetaPage`
  mehmon holati.
- **Simulator QA** (iPhone 17 Pro (Andoza), lokal backend :8001 + vite :5173; Android emulator ham): toza o'rnatish →
  login yo'q → wizard/LiDAR → Studio autosave → smeta + PDF → AI dizayner → oyna → ro'yxatdan o'tish → o'sha xona joyida;
  ikkinchi stsenariy: xonali akkauntga kirish → merge xabari; mehmon ma'lumotini o'chirish; ilovani yopib ochish → mehmon
  saqlangan; flag `false` → login ekrani.

## 7. Builder'ga qoldirilganlar

- `fill_ai_price_gaps` keshdagi narxni mehmonga ko'rsatish (bepul) yoki butunlay o'tkazish — hozircha butunlay o'tkaziladi.
- `/ai-build` SSE'da 403 stream ochilishidan oldin ketishini tasdiqlash (mobil `ApiClient.stream` va veb `aiBuildStream`).
- Veb `ApiError.message` = xom body; `isRegistrationRequired` JSON parse xatosiga chidamli bo'lsin.
- `PhotoToModelField` mehmonga umuman ko'rinmasligi mumkin (faqat sotuvchiga) — tekshirib, keraksiz gate qo'shmaslik.
- `docs/API.md`, `docs/ARCHITECTURE.md` (mobil) va `docs/CONFIGURATION.md` (veb: `GUEST_MODE_ENABLED`,
  `GUEST_REFRESH_TOKEN_EXPIRE_DAYS`) yangilanadi.

## 8. Men qilgan qarorlar (egasi tekshirsin)

1. Xato: **HTTP 403**, `detail.code = "registration_required"`, `detail.feature`, `detail.message`.
2. Ro'yxatga qo'shdim: `smeta/ask`, `render/upscale`, mebel workshop link (yopiq); `POST /reports` va `POST /wallpapers` (ochiq).
3. Smeta: mehmonga AI gap-fill va bozor narxi **jimgina** o'tkaziladi; bozor narxi tugmasi ko'rinadi va oynani ochadi.
4. Sign-in mavjud akkauntga = **so'ramasdan merge**, keyin xabar.
5. Mehmon refresh tokeni 90 kun; tozalash: xonasiz 14 kun, xonali 100 kun harakatsiz.
6. Yangi ustunlar `last_seen_at`, `registered_at` (metrikalar uchun).
7. Rate limit: IP 30/soat, install 3/kun, global 5000/kun; kill-switch `GUEST_MODE_ENABLED`.
8. Mehmonga push yo'q; profilda "Chiqish" o'rniga "Mehmon ma'lumotlarini o'chirish".
9. Mehmon sessiyasi o'lsa — jimgina yangi mehmon; ro'yxatdan o'tgan foydalanuvchi bugungidek `/login`.
10. Faqat ilova; sayt login talab qilishda davom etadi.
11. Mobil versiya `1.0.3+36`.
