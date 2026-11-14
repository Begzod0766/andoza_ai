# Do'kon egasi uchun "Oboy qo'shish": dizayn

Sana: 2026-11-15. Holat: tasdiq kutilmoqda.

## Maqsad va sabab

Bir do'kon egasi o'z oboyini sotmoqchi bo'lib, uning rasmini "Yangi mahsulot" formasidan yukladi. U forma faqat mebel uchun: rasmdan AI 3D model yasaydi. Natijada oboy Studio'da polda turgan barg naqshli panelga aylandi.

Do'kon egasining oboyni to'g'ri qo'shadigan joyi yo'q. Narx, do'kon va o'lchamli oboyni hozir faqat admin qo'sha oladi (admin "Oboylar" bo'limi).

Kerak bo'lgan natija:
- Do'kon egasi ilovadan ham, saytdagi do'kon panelidan ham o'z oboyini qo'sha oladi.
- Admin tasdiqlagach, oboy Studio'dagi oboy ro'yxatida chiqadi va devorga yopishadi.
- Smeta uni do'kon narxi bilan rulon bo'yicha hisoblaydi.

Muvaffaqiyat: do'kon egasi oboy rasmini 3D modelga aylantirmasdan sotuvga qo'yadi, mijoz uni Studio'da devorga qo'yib, smetada do'kon narxini ko'radi.

## Maqsadlar

- Do'kon egasi o'z do'koni uchun oboy qo'shadi, ko'radi, tahrirlaydi va o'chiradi.
- Kiritiladigan maydonlar: rasm, nom, 1 rulon narxi (so'm), rulon eni (sm), rulon uzunligi (m).
- Do'kon egasi qo'shgan oboy **admin tasdiqlaguncha hech kimga ko'rinmaydi** (egasining qarori: A varianti).
- Admin moderatsiya navbatida kutilayotgan oboylarni ko'radi va mebeldagi kabi tasdiqlaydi yoki sabab yozib rad etadi.
- Do'kon egasi o'z oboylarining holatini ko'radi: kutilmoqda, tasdiqlangan yoki rad etilgan (sababi bilan).
- Ilovaning "Yangi mahsulot" formasida va saytdagi 3D model formasida ogohlantirish bo'ladi: "Oboy qo'shmoqchimisiz? → Oboy qo'shish".

## Maqsad emas

- Fotopanno, ya'ni bitta bo'lak qilib sotiladigan devor rasmi (`height_cm`). Do'kon egasi uchun faqat rulon. Fotopannoni hozircha admin qo'shadi.
- Plitka, pol yoki suvoq turidagi kutubxonalar (`kind` = pol/suvoq/shpaklovka). Faqat `kind = "oboy"`.
- Bugungi xato yuklangan "oboy" 3D modelini avtomatik tuzatish. Uni admin qo'lda o'chiradi va kerak bo'lsa oboy sifatida qayta qo'shadi.
- Studio va smetaning oboyni chizish va hisoblash usulini o'zgartirish.

## Anti-maqsad (bu bo'lsa, ish muvaffaqiyatsiz)

- Tasdiqlanmagan yoki rad etilgan oboy Studio'da boshqa foydalanuvchiga ko'rinsa.
- Do'kon egasi boshqa do'konning oboyini o'zgartira yoki o'chira olsa.
- Hozir mavjud oboylar (admin qo'shganlari va foydalanuvchilarning shaxsiy rasmlari) Studio'dan yo'qolsa.
- Foydalanuvchining Studio'dagi oddiy "o'z rasmini oboy qilib yuklash" imkoniyati buzilsa.

## Hozirgi holat (kod bo'yicha)

- `backend/app/models/wallpaper.py`, `Wallpaper` jadvali:
  - maydonlar: `store_id`, `name`, `kind`, `price_uzs`, `width_cm`, `total_length_m`, `height_cm`, `storage_key`, `sha256`, `uploaded_by`;
  - `(sha256, kind)` takrorlanmas (unique).
  - Kutubxona umumiy: barcha qatorlar hammaga ko'rinadi.
- `backend/app/routers/wallpapers.py`:
  - `GET /wallpapers`: hammasi, `store_id` va `kind` bilan filtrlanadi.
  - `POST /wallpapers`: rasm yuklash. Metama'lumotsiz rasmni har qanday foydalanuvchi yuklay oladi, bu Studio'dagi "o'z oboyim". Nom, narx, do'kon va o'lchamni faqat admin kiritadi, aks holda 403.
  - `PATCH` va `DELETE`: faqat admin.
- `backend/app/services/estimate_catalog.py` smeta uchun `kind="oboy"` va narx, en, uzunligi bor oboylarni `WallpaperRoll` qiladi. `smeta.py` ning `_shop_wallpaper_lines` funksiyasi shu oboy qo'yilgan devorlarni rulon bo'yicha hisoblaydi.
- Mebel uchun do'kon egasi yo'li: `backend/app/routers/seller.py` (`/seller/furniture`), `_require_approved_store`. Moderatsiya: `backend/app/routers/admin_moderation.py` (`/pending`, `/furniture/{id}/approve|reject`, `_decide`). Holatlar ro'yxati: `MODERATION_STATUSES` (`app/models/store.py`). `Furniture` da `status` va `moderation_note` maydonlari bor.
- Sayt:
  - do'kon paneli: `frontend/src/pages/seller/SellerPage.tsx`, `SellerModelFormDialog.tsx`;
  - admin moderatsiyasi: `frontend/src/pages/dokon/admin/ModerationQueue.tsx`;
  - admin oboylari: `WallpaperSection.tsx`;
  - Studio oboy ro'yxati: `DesignPanel.tsx` (`listWallpapers({ kind })`).
- Ilova:
  - do'kon egasining ekranlari: `lib/screens/business/` ("Yangi mahsulot" uchun `add_product_screen.dart`, mahsulotlar ro'yxati uchun `shop_products_screen.dart`);
  - so'rovlar: `lib/repositories/business_repository.dart` (`/seller/furniture`).

## Yondashuvlar

1. **`Wallpaper` ga holat ustuni va do'kon egasi uchun yo'llar (tanlangan).** Mavjud jadval, Studio va smeta ishlatiladi. Faqat ko'rinish qoidasi va ruxsatlar qo'shiladi. Mebeldagi tartib bilan bir xil.
2. **Do'kon mahsuloti (`Material`, "oboy" turi) orqali.** Studio devor uchun `Material` ni o'qimaydi, shuning uchun Studio va smetani qayta yozish kerak bo'lardi. Rad etildi: katta va xavfli.
3. **Kutilayotganlar uchun alohida jadval.** Ochiq ro'yxatlarga tegmaydi, lekin ko'chirish mantig'i va ikki jadvalni moslash kerak. Rad etildi: ortiqcha murakkab.

Egasi 1-yondashuvni tanladi.

## Dizayn

### Backend

**Ma'lumotlar bazasi (Alembic migratsiyasi):**
- `wallpapers.status`: `String(20)`, NOT NULL, `server_default="approved"`, indeksli, `MODERATION_STATUSES` bo'yicha CHECK.
- `wallpapers.moderation_note`: `String(300)`, NULL bo'lishi mumkin.
- Mavjud barcha qatorlar `approved` bo'ladi, shuning uchun hozirgi oboylar yo'qolmaydi.

**Kim nimani ko'radi:**
- `GET /wallpapers` (Studio ro'yxati, hamma uchun) faqat `status == "approved"` qatorlarni qaytaradi. Bu faqat **yangi tanlov** uchun ro'yxat.
- Saqlangan xona oboyni ID bo'yicha emas, devor qoplamasidagi rasm URL bo'yicha chizadi (`designState.wallCoverings[*].url`). Shuning uchun oboy keyinchalik yashirilsa yoki rad etilsa ham, eski xonada devorda qoladi.
- `estimate_catalog` (smeta narxi) status bo'yicha faqat `pending` qatorlarni chiqarib tashlaydi.
  - Tasdiqlanganidan keyin yashirilgan yoki rad etilgan oboy uni ishlatayotgan xonalarda do'kon narxi bilan hisoblanaveradi, aks holda eski xonalar smetasidan narx jimgina yo'qolardi.
  - Kutilayotgan oboy hech bir devorga tanlab qo'yilmagan bo'ladi, chunki ro'yxatda ko'rinmaydi.
  - Do'kon egasi o'z kutilayotgan oboyini sinab ko'rmaydi (maqsad emas).
- Admin "Oboylar" bo'limi **barcha holatlarni** ko'rsatadi (holat belgisi va filtr bilan). Admin istalgan qatorni hozirgidek tahrirlaydi va o'chiradi. Kutilayotganlar qo'shimcha ravishda moderatsiya navbatida ham ko'rinadi.
- Oddiy foydalanuvchi Studio'dan yuklagan metama'lumotsiz rasm hozirgidek darhol `approved` bo'ladi (anti-maqsad: bu imkoniyat buzilmasin).

**Do'kon egasi uchun yo'llar (`seller.py`, `_require_approved_store`):**
- `GET /seller/wallpapers`: o'z do'konining oboylari, barcha holatlar bilan, yangisi birinchi.
- `POST /seller/wallpapers` (multipart): `file`, `name`, `price_uzs`, `width_cm`, `total_length_m`, hammasi majburiy.
  - Natija: `kind="oboy"`, `store_id` = o'z do'koni, `status="pending"`, `uploaded_by` = o'zi.
  - Rasm tekshiruvlari (tur, hajm) `POST /wallpapers` dagi bilan bir xil, umumiy funksiyaga chiqariladi.
- `PATCH /seller/wallpapers/{id}`: nom, narx, en, uzunlikni o'zgartirish.
  - Faqat o'z do'koniniki bo'lsa ruxsat, aks holda 404.
  - Tasdiqlangan oboyning **narxi** o'zgarsa, qayta tekshiruvsiz qoladi, chunki narx do'konning ishi.
  - **Nom** o'zgarsa ham shunday, qayta moderatsiya talab qilinmaydi (mening qarorim, pastga qarang).
  - Rasmni (ixtiyoriy `file`) faqat `pending` yoki `rejected` oboyda almashtirish mumkin, chunki bunday oboy hech bir xonada ishlatilmagan. Tasdiqlangan oboyning rasmi almashtirilmaydi: saqlangan xonalar eski URL bilan bog'langan.
  - Rad etilgan oboy tahrirlansa, holati yana `pending` bo'ladi va `moderation_note` tozalanadi. Bu "qayta yuborish".
  - Do'kon egasi yashirgan oboy ham tahrirlash orqali qayta yuboriladi (`pending`).
- Bitta do'konda bir vaqtda ko'pi bilan 50 ta kutilayotgan oboy bo'lishi mumkin, undan oshsa 429.
- Har bir do'kon egasining bitta do'koni bor (`_own_store` `owner_user_id` bo'yicha bitta qator qaytaradi), shuning uchun `store_id` so'ralmaydi.
- `DELETE /seller/wallpapers/{id}`: faqat o'z do'koniniki.
  - Kutilayotgan yoki rad etilgan oboy o'chiriladi.
  - Tasdiqlangan oboy esa o'chirilmaydi, balki ro'yxatdan yashiriladi (`status="rejected"`, eslatma "Do'kon olib tashladi"), chunki saqlangan xonalar shu rasmni ishlatayotgan bo'lishi mumkin. Model izohida yozilgan qoida: "entries live until an admin deletes them".

**Bir xil rasm (`sha256`, `kind`):**
- Bunday rasm allaqachon bor bo'lsa, `POST /seller/wallpapers` 409 qaytaradi.
  - Rasm o'z do'konining oboyi bo'lsa, xabar: "Bu oboy ro'yxatingizda bor, uni tahrirlang".
  - Boshqa holatda: "Bu rasm kutubxonada allaqachon bor".
- Begona qatorga metama'lumot yozilmaydi, egasi yo'q qatorga ham. Hozirgi `POST /wallpapers` dagi "qayta yuklash metama'lumotni yangilaydi" xatti-harakati do'kon egasiga berilmaydi, chunki u boshqa birovning oboyini o'ziniki qilib olishi mumkin edi.
- Oddiy foydalanuvchi Studio'dan kutilayotgan yoki rad etilgan do'kon oboyi bilan bir xil rasmni yuklasa, `POST /wallpapers` hozirgidek mavjud qatorni qaytaradi. Studio qaytgan URL ni devorga darhol qo'yadi, shuning uchun foydalanuvchi uchun hammasi ishlaydi. Faqat Studio ro'yxatida u tasdiqlanguncha ko'rinmaydi. Takrorlanmaslik kaliti `(sha256, kind)` o'zgarmaydi.

**Moderatsiya (`admin_moderation.py`):**
- `GET /pending` javobiga `wallpapers` ro'yxati qo'shiladi: rasm URL, nom, narx, en, uzunlik, do'kon nomi, yuklangan sana.
- Yangi yo'llar `POST /wallpapers/{id}/approve` va `POST /wallpapers/{id}/reject` (`RejectIn`: sabab). `_decide` mantig'i bilan.
- `Wallpaper` da `is_active` yo'q, shuning uchun faqat `status` va `moderation_note` o'rnatiladi.

### Sayt (andoza_ai frontend)

- `SellerPage` ga "Oboylar" bo'limi qo'shiladi:
  - ro'yxatda kichik rasm, nom, "1 rulon: X so'm", "Y sm × Z m" va holat belgisi (Kutilmoqda / Tasdiqlangan / Rad etildi: sabab);
  - "Oboy qo'shish" tugmasi.
- `SellerWallpaperFormDialog`: rasm, nom, narx, en (sm), uzunlik (m).
  - Rasm ostida yozuv: "Oboyning naqshi aniq ko'rinadigan, tekis rasm. Bu rasm Studio'da devorga yopishtiriladi".
  - Saqlangach: "Admin tasdiqlagach Studio'da ko'rinadi".
  - Tahrirlashda shu dialogning o'zi ishlatiladi, rasm maydonisiz.
- `SellerModelFormDialog` ga ogohlantirish qo'shiladi: "Oboy qo'shmoqchimisiz? → Oboy qo'shish" (oboy dialogini ochadi).
- `ModerationQueue` ga kutilayotgan oboylar qo'shiladi: rasm, ma'lumotlari va Tasdiqlash / Rad etish tugmalari, mebeldagi kabi.
- Matnlar `uz`, `ru`, `en` uchta tilda.

### Ilova (andoza_ai_mobile)

- `business_repository.dart` ga `/seller/wallpapers` uchun list, create (multipart), update va delete qo'shiladi.
- Yangi ekran: `add_wallpaper_screen.dart`, sarlavhasi "Oboy qo'shish".
  - Rasm galereyadan yoki kameradan olinadi, "Yangi mahsulot" dagi kabi.
  - Maydonlar: nom, narx, en (sm), uzunlik (m).
  - Saqlangach: "Admin tasdiqlagach Studio'da ko'rinadi".
- Do'kon egasining mahsulotlar ekranida (`shop_products_screen.dart`) "Oboylar" bo'limi yoki tabi bo'ladi: ro'yxat holati bilan, "Oboy qo'shish" tugmasi, tahrirlash va o'chirish.
- `add_product_screen.dart` ga ogohlantirish qo'shiladi: "Oboy qo'shmoqchimisiz?" havolasi oboy ekraniga olib boradi.
- Yangi yo'nalish (route) business muharrirlari kabi root navigator'da bo'ladi (`CLAUDE.md` qoidasi).
- Matnlar `app_uz.arb`, `app_ru.arb`, `app_en.arb` da.
- Ilova o'zgarishi do'konga yangi versiya (1.0.x) sifatida chiqadi. U do'kon yuklashlari to'xtatilgani sababli boshqa ishlar bilan birga yuboriladi.

### Tartib

1. Backend va migratsiya, keyin deploy. Eski ilova va saytni buzmaydi: faqat yangi yo'llar qo'shiladi, `GET /wallpapers` esa hozir ham faqat tasdiqlanganlarni beradi.
2. Sayt: do'kon paneli va moderatsiya.
3. Ilova.

## Builder qaroriga qoldirilganlar

- Ro'yxat va formaning aniq ko'rinishi (mavjud seller va business ekranlari uslubida).
- Maydonlar chegaralari (narx > 0, en 30–150 sm, uzunlik 1–50 m kabi oqilona qiymatlar).
- Testlar: backend (pytest) uchun ruxsat, ko'rinish va moderatsiya holatlari; sayt (vitest) va ilova (flutter test) uchun forma va ro'yxat.

## Mening qarorlarim (egasi tekshirsin)

- Fotopanno do'kon egasi uchun yo'q, faqat rulon.
- Tasdiqlangan oboyning nomi yoki narxi o'zgarsa, qayta moderatsiya talab qilinmaydi.
- Tasdiqlangan oboyni do'kon egasi o'chirsa, u butunlay o'chmaydi, faqat yashiriladi, chunki saqlangan xonalar uni ishlatayotgan bo'lishi mumkin.
- Bir xil rasm qayta yuklansa, 409 qaytadi. O'z oboyi bo'lsa, "tahrirlang" deyiladi.
- Smeta yashirilgan yoki keyin rad etilgan oboyni uni ishlatayotgan eski xonalarda narxi bilan hisoblashda davom etadi.
- Rasmni faqat hali tasdiqlanmagan oboyda almashtirish mumkin.
- Admin "Oboylar" bo'limida barcha holatlar ko'rinadi.
- Bir do'konda ko'pi bilan 50 ta kutilayotgan oboy.
