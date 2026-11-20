# Do'kon egasi uchun "Oboy qo'shish": amalga oshirish rejasi

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Do'kon egasi o'z oboyini (rulon) sayt va ilovadan qo'shadi; admin tasdiqlagach u Studio'da chiqadi va smetada do'kon narxi bilan hisoblanadi.

**Architecture:** Mavjud `wallpapers` jadvaliga `status` + `moderation_note` qo'shiladi (mavjud qatorlar `approved`). Ochiq ro'yxat faqat `approved`ni beradi; do'kon egasi uchun `/seller/wallpapers` CRUD (`seller.py`), admin uchun `admin_moderation.py`da tasdiqlash/rad etish. Sayt (`SellerPage`, `ModerationQueue`, `WallpaperSection`) va Flutter ilova (`business_repository`, yangi `AddWallpaperScreen`) shu yo'llarni ishlatadi.

**Tech Stack:** FastAPI + SQLAlchemy async + Alembic + pytest (backend); React + TanStack Query + vitest (frontend); Flutter + Riverpod + go_router + flutter_test (ilova).

**Spec:** `docs/superpowers/specs/2026-11-15-dokon-oboy-qoshish-design.md`

**Repos/worktree'lar:** Task 1–6: `~/Projects/andoza_ai/.claude/worktrees/seller-wp` (branch `feat/seller-wallpapers`). Task 7–8: `andoza_ai_mobile` uchun yangi worktree (branch `feat/seller-wallpapers`, `origin/main` dan). Node: `~/.local/node/bin`.

## Global Constraints

- Holatlar: `MODERATION_STATUSES = ("pending", "approved", "rejected")` (`app/models/store.py`) — yangi qiymat qo'shilmaydi.
- Mavjud barcha `wallpapers` qatorlari migratsiyadan keyin `approved`; oddiy foydalanuvchining Studio'dan metama'lumotsiz yuklashi (`POST /wallpapers`) darhol `approved` bo'lib qoladi.
- Do'kon egasi yaratgan oboy: `kind="oboy"`, `store_id` = o'z do'koni, `status="pending"`. Maydonlar: rasm, `name` (1–120), `price_uzs` (> 0), `width_cm` (30–150), `total_length_m` (1–50). `height_cm` yo'q (fotopanno maqsad emas).
- Tasdiqlangan oboyning nomi/narxi tahriri qayta moderatsiya qilmaydi. `rejected` oboy tahrirlansa → `pending`, `moderation_note=None`.
- Rasm almashtirish faqat `pending`/`rejected` oboyda; `approved`da 409.
- Do'kon egasi `approved` oboyni o'chirsa: qator qoladi, `status="rejected"`, `moderation_note="Do'kon olib tashladi"`. `pending`/`rejected` esa haqiqatan o'chiriladi.
- Bir xil `(sha256, kind)` → 409: o'z do'koniniki bo'lsa `"Bu oboy ro'yxatingizda bor, uni tahrirlang"`, aks holda `"Bu rasm kutubxonada allaqachon bor"`. Begona qatorga metama'lumot yozilmaydi.
- Bir do'konda `pending` oboy ≤ 50; 51-chisi → 429 `"Tekshiruvni kutayotgan oboylar juda ko'p (50)"`.
- Smeta katalogi (`estimate_catalog`) faqat `pending`ni chiqaradi (`rejected` eski xonalarda narxlanaveradi).
- Matnlar uchta tilda: sayt `uz/ru/en.json`, ilova `app_uz.arb` (`@key` tavsifi bilan) + `app_ru.arb` + `app_en.arb`. Ilova yo'nalishi root navigator'da (`parentNavigatorKey`).
- O'zbekcha UI matnlari (aynan): forma izohi `"Oboyning naqshi aniq ko'rinadigan, tekis rasm. Bu rasm Studio'da devorga yopishtiriladi."`; saqlangach `"Admin tasdiqlagach Studio'da ko'rinadi."`; ogohlantirish `"Oboy qo'shmoqchimisiz?"` + havola `"Oboy qo'shish"`; holatlar `"Kutilmoqda"`, `"Tasdiqlangan"`, `"Rad etildi"`.
- Hech qachon token yoki so'rov tanasini loglamang (ilova qoidasi).

## Review Focus

1. Boshqa do'kon egasi begona oboyni `PATCH`/`DELETE` qilsa → 404, qator o'zgarmaydi (Task 2 testi).
2. Do'koni tasdiqlanmagan (pending/rejected) foydalanuvchi `/seller/wallpapers`ga yozsa → 403 (Task 2 testi).
3. Do'kon egasi eski `POST /wallpapers` orqali `name`/`price_uzs`/`store_id` yuborsa → hali ham 403, chetlab o'tolmaydi (Task 1 testi).
4. Do'kon egasi yashirgan (avval tasdiqlangan) oboy eski xona smetasida narxi bilan qoladi (Task 1 testi, `estimate_catalog`).
5. Tasdiqlanmagan oboy ochiq `GET /wallpapers` (`kind=oboy` bilan ham, `store_id` bilan ham) javobida yo'q (Task 1 testi).

---

### Task 1: `status` ustuni va ko'rinish qoidalari (backend)

**Files:**
- Create: `backend/alembic/versions/1786000050_wallpaper_moderation.py` (`down_revision` = bajarish paytidagi `alembic heads`; hozir `1786000049`)
- Modify: `backend/app/models/wallpaper.py`, `backend/app/schemas/wallpaper.py`, `backend/app/routers/wallpapers.py`, `backend/app/services/estimate_catalog.py`
- Test: `backend/tests/test_wallpapers.py`, `backend/tests/test_estimate_catalog.py`

**Interfaces:**
- Produces: `Wallpaper.status: str`, `Wallpaper.moderation_note: str | None`; `WallpaperOut.status: str`, `WallpaperOut.moderation_note: str | None`; `GET /wallpapers/all` (`AdminUser`, `store_id`/`kind`/`page`/`per_page` xuddi ochiq ro'yxatdagidek) barcha holatlarni beradi; ochiq `GET /wallpapers` auth'siz qoladi; `read_wallpaper_image(file: UploadFile) -> bytes` (`wallpapers.py`, turi/bo'shligi/hajmini tekshiradi, xatoda shu HTTPException'lar) — Task 2 ishlatadi; `_out(w, request)` modul darajasida qoladi.

- [ ] **Step 1: Failing testlar**
  - `test_public_list_hides_pending_and_rejected`: DB `approved`, `pending`, `rejected` qaytarsa ham so'rovga `Wallpaper.status == "approved"` sharti qo'shilganini tekshiring (mock `execute` chaqirilgan SQL matnida `wallpapers.status` va `'approved'`/bind bor) — `kind=oboy` va `store_id=` bilan ham.
  - `test_admin_all_lists_every_status`: admin `GET /wallpapers/all` → so'rovda status sharti yo'q; oddiy foydalanuvchi → 403.
  - `test_wallpaper_out_has_status`: javob JSON'da `status` va `moderation_note` bor.
  - `test_plain_user_upload_is_approved`: metama'lumotsiz `POST /wallpapers` → yaratilgan `Wallpaper.status == "approved"`.
  - `test_seller_cannot_set_price_via_public_upload`: admin bo'lmagan foydalanuvchi `price_uzs=1000` bilan `POST /wallpapers` → 403 (mavjud xatti-harakat qotiriladi).
  - `test_estimate_catalog`: `pending` qator katalogga kirmaydi; `rejected` (narx/en/uzunlik bor) kiradi.
- [ ] **Step 2:** `cd backend && uv run pytest tests/test_wallpapers.py tests/test_estimate_catalog.py -q` → yangi testlar FAIL.
- [ ] **Step 3:** Migratsiya: `status` `String(20)` NOT NULL `server_default='approved'` indeksli + CHECK `status IN ('pending','approved','rejected')` (nom `ck_wallpapers_status`), `moderation_note String(300)` NULL. Model maydonlari `Furniture.status/moderation_note` kabi. `list_wallpapers`ga `where(Wallpaper.status == "approved")`; filtr/sahifalash mantig'ini `_list_query(store_id, kind, page, per_page, approved_only: bool)`ga chiqarib, `GET /wallpapers/all` (`AdminUser`) uni `approved_only=False` bilan ishlatsin (yo'l `/{id}` yo'llaridan oldin e'lon qilinsin). Rasm tekshiruvini `read_wallpaper_image`ga chiqaring va `upload_wallpaper` uni chaqirsin. `estimate_catalog` so'roviga `Wallpaper.status != "pending"`.
- [ ] **Step 4:** Step 2 buyrug'i → hammasi PASS; `uv run alembic upgrade head` (lokal pgserver) xatosiz.
- [ ] **Step 5:** `git commit -m "Wallpapers: a moderation status; the public list shows approved ones only"`

### Task 2: `/seller/wallpapers` (backend)

**Files:**
- Modify: `backend/app/routers/seller.py`, `backend/app/schemas/seller.py`
- Test: Create `backend/tests/test_seller_wallpapers.py` (mock uslubi `tests/test_seller.py` dagi kabi)

**Interfaces:**
- Consumes: Task 1 `read_wallpaper_image`, `WallpaperOut`, `_out`.
- Produces:
  - `GET /seller/wallpapers` → `list[WallpaperOut]` (o'z do'koni, barcha holat, `created_at desc`)
  - `POST /seller/wallpapers` multipart: `file`, `name`, `price_uzs:int`, `width_cm:float`, `total_length_m:float` → 201 `WallpaperOut`
  - `PATCH /seller/wallpapers/{id}` multipart: ixtiyoriy `file`, `name`, `price_uzs`, `width_cm`, `total_length_m` → `WallpaperOut`
  - `DELETE /seller/wallpapers/{id}` → 204
  - Xatolar: tasdiqlanmagan do'kon 403 (`_require_approved_store`), begona/yo'q 404 `"Oboy topilmadi"`, takror 409 (Global Constraints matnlari), cheklov 422, 51-pending 429.

- [ ] **Step 1: Failing testlar** (`test_seller_wallpapers.py`):
  - `test_create_is_pending_in_own_store` — status `pending`, `kind=="oboy"`, `store_id==own.id`, `uploaded_by==user.id`.
  - `test_create_requires_approved_store` — pending do'kon → 403.
  - `test_create_validates_ranges` — `price_uzs=0`, `width_cm=20`, `total_length_m=60`, `name=""` → har biri 422.
  - `test_duplicate_own_image_409_edit_hint` / `test_duplicate_foreign_image_409` — matnlar Global Constraints'dagidek; begona qator o'zgarmagan.
  - `test_pending_cap_429` — 50 ta pending bor → 429.
  - `test_list_only_own_store`.
  - `test_patch_foreign_404`, `test_delete_foreign_404` (Review Focus 1).
  - `test_patch_rejected_resubmits` — `rejected` + nom tahriri → `pending`, note `None`.
  - `test_patch_approved_name_price_stays_approved`.
  - `test_patch_file_on_approved_409` / `test_patch_file_on_pending_replaces` — yangi `storage_key`, `sha256`.
  - `test_delete_pending_removes_row` / `test_delete_approved_hides` — `status=="rejected"`, `moderation_note=="Do'kon olib tashladi"`, qator o'chirilmagan.
- [ ] **Step 2:** `uv run pytest tests/test_seller_wallpapers.py -q` → FAIL (404 yo'llar).
- [ ] **Step 3:** Yo'llarni `seller.py`da mebel yo'llari yonida yozing; o'z qatorini olish `_own_wallpaper(db, user, id) -> Wallpaper` (`_own_model` kabi). Saqlash `upload_file` (wallpapers.py dagi kabi kalit `wallpapers/<uuid>.<ext>`). Validatsiya `Form(..., ge/le/min_length/max_length)` bilan.
- [ ] **Step 4:** `uv run pytest tests/test_seller_wallpapers.py tests/test_seller.py tests/test_wallpapers.py -q` → PASS.
- [ ] **Step 5:** `git commit -m "Seller: add, edit and remove the shop's own wallpapers; they wait for an admin"`

### Task 3: Moderatsiya (backend)

**Files:**
- Modify: `backend/app/routers/admin_moderation.py`, `backend/app/schemas/seller.py`
- Test: Create `backend/tests/test_moderation_wallpapers.py`

**Interfaces:**
- Produces: `PendingWallpaperOut(WallpaperOut)` (+`store_name` allaqachon bor); `PendingOut.wallpapers: list[PendingWallpaperOut] = []`; `POST /admin/moderation/wallpapers/{id}/approve` → 204; `POST /admin/moderation/wallpapers/{id}/reject` (`RejectIn`) → 204; 404 `"Oboy topilmadi"`.

- [ ] **Step 1: Failing testlar:** `test_pending_lists_wallpapers` (faqat `pending`, `created_at` bo'yicha); `test_approve_sets_approved_clears_note`; `test_reject_sets_note`; `test_non_admin_403`; `test_unknown_404`.
- [ ] **Step 2:** `uv run pytest tests/test_moderation_wallpapers.py -q` → FAIL.
- [ ] **Step 3:** `_wallpaper(db, id)` + yo'llar; `_decide` `is_active`ni o'rnatadi — `Wallpaper`da yo'q, shuning uchun `_decide_status(row, approved, note)` (faqat `status` va `moderation_note`) yozing va `_decide` uni chaqirsin.
- [ ] **Step 4:** `uv run pytest -q` (butun backend) → PASS.
- [ ] **Step 5:** `git commit -m "Moderation: shops' wallpapers in the queue, approve or reject"`

### Task 4: Sayt API qatlami

**Files:**
- Modify: `frontend/src/lib/api/seller.ts`, `frontend/src/lib/api/wallpapers.ts`
- Test: Create `frontend/src/lib/api/__tests__/sellerWallpapers.test.ts`

**Interfaces:**
- Produces (`seller.ts`): `listMyWallpapers(): Promise<Wallpaper[]>`; `uploadMyWallpaper(input: { file: File; name: string; priceUzs: number; widthCm: number; totalLengthM: number }): Promise<Wallpaper>`; `updateMyWallpaper(id: string, patch: { file?: File; name?: string; priceUzs?: number; widthCm?: number; totalLengthM?: number }): Promise<Wallpaper>`; `deleteMyWallpaper(id: string): Promise<void>`; `ModerationTarget` ga `"wallpapers"`; `PendingQueue.wallpapers?: Wallpaper[]`.
- Produces (`wallpapers.ts`): `Wallpaper.status: ModerationStatus`, `Wallpaper.moderation_note: string | null`; `listAllWallpapers(params: { store_id?: string; kind?: string } = {}): Promise<Wallpaper[]>` → `GET /wallpapers/all`.

- [ ] **Step 1:** Failing test: `uploadMyWallpaper` `POST /seller/wallpapers`ga FormData (`file,name,price_uzs,width_cm,total_length_m`) yuboradi; `updateMyWallpaper` faqat berilgan maydonlarni `PATCH` qiladi; `listAllWallpapers()` `/wallpapers/all`ni chaqiradi.
- [ ] **Step 2:** `npx vitest run src/lib/api/__tests__/sellerWallpapers.test.ts` → FAIL.
- [ ] **Step 3:** Funksiyalarni mavjud `uploadMyModel`/`uploadWallpaper` uslubida yozing.
- [ ] **Step 4:** Shu buyruq → PASS; `npx tsc` toza.
- [ ] **Step 5:** `git commit -m "Web API: the seller's wallpapers and their moderation"`

### Task 5: Do'kon paneli — "Oboylar" (sayt)

**Files:**
- Create: `frontend/src/pages/seller/SellerWallpapers.tsx` (ro'yxat + qo'shish/tahrir/o'chirish), `frontend/src/pages/seller/SellerWallpaperFormDialog.tsx`
- Modify: `frontend/src/pages/seller/SellerPage.tsx` (bo'limni qo'shish), `frontend/src/pages/seller/SellerModelFormDialog.tsx` (ogohlantirish), `frontend/src/i18n/locales/{uz,ru,en}.json` (`seller.wallpapers.*`)
- Test: Create `frontend/src/pages/seller/SellerWallpapers.test.tsx`; Modify `SellerPage.test.tsx`

**Interfaces:**
- Consumes: Task 4 funksiyalari. `StatusBadge` (mavjud) holat belgisi uchun.
- Produces: `SellerModelFormDialog` yangi prop `onAddWallpaper?: () => void` — havola bosilganda dialog yopilib shu chaqiriladi; `SellerPage` uni `SellerWallpapers` dialogini ochishga ulaydi.

- [ ] **Step 1: Failing testlar:**
  - ro'yxatda nom, `"1 rulon: 120 000 so'm"` ko'rinishidagi narx, `"106 sm × 10 m"`, holat belgisi, rad etilganda sabab matni;
  - forma: hamma maydon to'ldirilmaguncha "Saqlash" o'chiq; saqlanganda `uploadMyWallpaper` to'g'ri qiymatlar bilan chaqiriladi va `"Admin tasdiqlagach Studio'da ko'rinadi."` chiqadi;
  - tahrirda rasm maydoni faqat `pending`/`rejected`da ko'rinadi;
  - 409 javob matni foydalanuvchiga ko'rsatiladi;
  - `SellerModelFormDialog`da `"Oboy qo'shmoqchimisiz?"` va `"Oboy qo'shish"` bosilsa `onAddWallpaper` chaqiriladi.
- [ ] **Step 2:** `npx vitest run src/pages/seller` → FAIL.
- [ ] **Step 3:** Komponentlarni `SellerModelCard`/`SellerModelFormDialog` uslubida yozing; o'chirishdan oldin `useConfirm`.
- [ ] **Step 4:** `npx vitest run src/pages/seller` → PASS; `npx tsc` toza.
- [ ] **Step 5:** `git commit -m "Seller page: the shop's wallpapers, add and edit them"`

### Task 6: Admin — navbat va "Oboylar" bo'limi (sayt)

**Files:**
- Modify: `frontend/src/pages/dokon/admin/ModerationQueue.tsx`, `frontend/src/pages/dokon/admin/WallpaperSection.tsx`, `frontend/src/i18n/locales/{uz,ru,en}.json`
- Test: `ModerationQueue` va `WallpaperSection` uchun mavjud testlar yonida (`frontend/src/pages/dokon/admin/__tests__/` yoki fayl yonidagi `*.test.tsx`)

**Interfaces:**
- Consumes: Task 4 `PendingQueue.wallpapers`, `approvePending("wallpapers", id)`, `rejectPending("wallpapers", id, note)`, `listAllWallpapers()`.

- [ ] **Step 1: Failing testlar:** navbatda oboy kartasi (rasm, nom, narx, `"106 sm × 10 m"`, do'kon nomi) va Tasdiqlash/Rad etish tegishli funksiyani chaqiradi; `WallpaperSection` `listAllWallpapers`ni chaqiradi va holat belgisini ko'rsatadi.
- [ ] **Step 2:** `npx vitest run src/pages/dokon/admin` → FAIL.
- [ ] **Step 3:** Mebel kartasi uslubida qo'shing.
- [ ] **Step 4:** `npx vitest run` (butun frontend) → PASS; `npx tsc` toza.
- [ ] **Step 5:** `git commit -m "Admin: shops' wallpapers in the moderation queue; the library shows every status"`

### Task 7: Ilova — model va repository

**Files:**
- Modify: `lib/models/business_profile.dart` (`ShopWallpaper`), `lib/repositories/business_repository.dart`
- Test: Create `test/unit/shop_wallpaper_test.dart`; repository testi mavjud repository testlari uslubida (`test/unit/` ichida, fake `ApiClient` bilan)

**Interfaces:**
- Produces: `class ShopWallpaper { String id; String name; String url; int? priceUzs; double? widthCm; double? totalLengthM; String status; String? moderationNote; DateTime createdAt; factory ShopWallpaper.fromJson(Map<String,dynamic>) }`; repository: `Future<List<ShopWallpaper>> fetchWallpapers()`, `Future<ShopWallpaper> addWallpaper({required List<int> bytes, required String filename, required String contentType, required String name, required int priceUzs, required double widthCm, required double totalLengthM})`, `Future<ShopWallpaper> updateWallpaper(String id, {List<int>? bytes, String? filename, String? contentType, String? name, int? priceUzs, double? widthCm, double? totalLengthM})`, `Future<void> deleteWallpaper(String id)`; Riverpod `shopWallpapersProvider` (`FutureProvider.autoDispose<List<ShopWallpaper>>`, mavjud `shopProductsProvider` yonida).

- [ ] **Step 1:** Failing testlar: `fromJson` backend `WallpaperOut` namunasidan (`status`, `moderation_note`, `width_cm`, `total_length_m`); `addWallpaper` `/seller/wallpapers`ga `uploadFiles` bilan `file` va maydonlarni (`price_uzs` string) yuboradi.
- [ ] **Step 2:** `flutter test test/unit/shop_wallpaper_test.dart` → FAIL.
- [ ] **Step 3:** `uploadFiles` (mavjud) bilan; `updateWallpaper` fayl berilmasa `fields`ni multipart `PATCH` qiladi — `ApiClient`da multipart PATCH bo'lmasa, `uploadFiles`ga `method` parametri qo'shing (standart `POST`).
- [ ] **Step 4:** `flutter test test/unit` → PASS; `flutter analyze` toza.
- [ ] **Step 5:** `git commit -m "feat(shop): seller wallpapers in the business repository"`

### Task 8: Ilova — "Oboy qo'shish" ekrani va ro'yxat

**Files:**
- Create: `lib/screens/business/add_wallpaper_screen.dart` (yaratish va tahrirlash; tahrirda `ShopWallpaper` `extra` bilan keladi)
- Modify: `lib/screens/business/shop_products_screen.dart` (Mebel / Oboylar tablari; oboy plitkasi: rasm, nom, narx, o'lcham, holat, rad sababi; tahrir/o'chirish), `lib/screens/business/add_product_screen.dart` (ogohlantirish havolasi), `lib/config/router.dart` (`/business/add-wallpaper`, root navigator), `lib/l10n/app_{uz,ru,en}.arb` + `flutter gen-l10n`
- Test: Create `test/widget/add_wallpaper_test.dart`; Modify `test/widget/shop_products_test.dart`

**Interfaces:**
- Consumes: Task 7 repository va `shopWallpapersProvider`.

- [ ] **Step 1: Failing testlar:**
  - forma: rasm tanlanmaguncha yoki maydonlar bo'sh/chegaradan tashqarida bo'lsa (en 30–150, uzunlik 1–50, narx > 0) saqlash o'chiq; to'g'ri qiymatlarda `addWallpaper` chaqiriladi va `"Admin tasdiqlagach Studio'da ko'rinadi."` SnackBar;
  - 409 javobdagi server matni ko'rsatiladi;
  - `shop_products_screen`: "Oboylar" tabida plitkalar holat bilan, rad etilganda sabab; o'chirishda tasdiq dialogi;
  - `add_product_screen`: `"Oboy qo'shmoqchimisiz?"` havolasi `/business/add-wallpaper`ga o'tadi;
  - ru lokalda sarlavha tarjima qilingan.
- [ ] **Step 2:** `flutter test test/widget/add_wallpaper_test.dart test/widget/shop_products_test.dart` → FAIL.
- [ ] **Step 3:** Rasm tanlash `add_product_screen.dart` dagi `ImagePicker().pickImage(maxWidth: 1600, imageQuality: 88)` bilan bir xil. Ruscha/inglizcha matnlar: "Добавить обои" / "Add wallpaper" va hokazo.
- [ ] **Step 4:** `flutter test` (hammasi) → PASS; `flutter analyze` toza. Simulyatorda prod'ga qarshi qo'lda: oboy qo'shish → "Kutilmoqda" ko'rinishi (backend deploy'dan keyin).
- [ ] **Step 5:** `git commit -m "feat(shop): add a wallpaper from the app; the shop's wallpapers with their status"`

## Yakun

- Backend + sayt (Task 1–6) bitta PR `Begzod0766/andoza_ai`ga; merge va deploy egasi "merge" deganda.
- Ilova (Task 7–8) alohida PR `andoza_ai_mobile`ga; do'konga yuklash to'xtatilgan — versiya oshirish va yuklash egasi so'raganda keyingi to'plam bilan.
- Bugungi xato yuklangan "oboy" 3D modelini admin qo'lda o'chiradi (rejadan tashqari).
