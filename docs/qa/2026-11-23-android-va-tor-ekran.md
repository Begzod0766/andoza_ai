# Android (mehmon rejimi, Studio qo'llanmasi) va tor iPhone'da landing (2026-11-23)

**Nima tekshirildi:** oldingi telefon QA'lari tekshira olmagan bandlar.
- **A. Android:** mehmon rejimi (oldin faqat iOS'da ko'rilgan), Studio qo'llanmasi (#377 + #384) va **tizim Back** tugmasi (iOS'da yo'q), tur o'rtasida ekranni burish.
- **B. Tor iPhone (390 pt):** landing (#382). Oldingi tekshiruv faqat 402 px va faqat UZ/EN edi.

## Muhit

| | |
|---|---|
| Android | Emulyator AVD `andoza_pixel` (sdk_gphone64_arm64, Android 14 / API 34, 1080×2400, 420 dpi). Real akkaunt yo'q, ilova ma'lumotlari boshida tozalandi (`pm clear`). |
| Android ilova | `andoza_ai_mobile` `main` @ `13cf53b` (1.0.3+36), **debug APK**, prod'ga: `API_URL=https://andozaai.uz/api/v1`, `API_BASE_URL=https://andozaai.uz`, `STUDIO_BASE_URL=https://andozaai.uz`. Ilova tili qo'lda **O'zbekcha** qilindi (emulyator ingliz tilida). |
| iPhone | iOS Simulator **iPhone 16e** (390×844 pt), mobil Safari. «iPhone 17 Pro (Andoza)» ishlatilmadi. |
| Sahifa | `https://andozaai.uz/landing` |
| Bundle | B (landing) 19:21–19:31 da: `index-DPEgrLHk.js`. **19:36 da prod yangilandi** (andoza_ai#387 deploy, «Quritgich dush ichida…»), A dagi Studio bandlari yangi bundle'da: `index-BE4mZyUd.js`. |
| Vaqt | 19:21–19:45 (Toshkent) |

Hech qanday render, AI generatsiya yoki pullik amal bajarilmadi. Ro'yxatdan o'tilmadi, kirilmadi, login/parol/telefon raqami kiritilmadi.

## A. Android natijalari

| # | Band | Natija | Nima ko'rildi |
|---|---|---|---|
| A1 | Debug APK yig'ildi, emulyatorga o'rnatildi | ✅ | `flutter build apk --debug …` 128 s, `adb install -r` → Success. Paket `andozaai.com`. |
| A2.1 | Ilova login'siz, mehmon sifatida ochiladi | ✅ | Ilova kirish ekrani bilan ochiladi, ostida **«Ro'yxatdan o'tmasdan davom etish»** va «Xonalaringiz bu qurilmada mehmon sifatida saqlanadi.» Shu tugma bosilgach, login so'ralmasdan bosh sahifa ochildi (ilova ichidagi 1/4 «Yangi loyiha» ko'rsatmasi bilan). Rasm 01. |
| A2.2 | Wizard bilan xona yaratish | ✅ | «+ Loyiha qo'shish» → «3D Master» → Yotoqxona, 2.7 m → A/B/C/D devorlar (standart o'lchamlar) → «O'lchamlar tayyor»: pol 14.0 m², devor 40.5 m², perimetr 15.0 m. Rasm 02 chap. |
| A2.3 | Smetada mehmon eslatmasi | ✅ | «Smeta ko'rish» → tepada ko'k blok: **«Narxlar taxminiy. Ro'yxatdan o'tsangiz, aniqlashtiriladi.»** va «Ro'yxatdan o'tish» havolasi. Umumiy narx 22 544 200 so'm. Eslatma sahifa ochilgandan ~1 s keyin chiqadi (birinchi kadrda yo'q edi). Rasm 02 o'ng. |
| A2.4 | Pullik amal → ro'yxatdan o'tish oynasi, hech narsa sarflanmaydi | ✅ | «AI dizayner» → bo'sh matn bilan «Yaratish» hech narsa qilmaydi. «oq devorlar» yozilib «Yaratish» bosildi → pastdan oyna: **«Bu imkoniyat uchun ro'yxatdan o'ting»**, «AI quruvchi», «Xonalaringiz saqlanib qoladi va hisobingizga o'tadi.», «Ro'yxatdan o'tish» / «Keyinroq». «Keyinroq» bosildi, generatsiya boshlanmadi. Rasm 03. |
| A2.5 | 3D Studio ochiladi | ✅ (2-urinishda) | 1-urinish (19:36:30 atrofida): WebView'da **«502 Bad Gateway, nginx»** (rasm 04). Aynan shu daqiqada #387 deploy tugayotgan edi (`gh run`: Deploy 14:30:42Z + 6m18s ≈ 19:37). `/health` 19:36:49 da 200. Studio'dagi «←» bilan chiqib qayta ochilganda (19:38) sahna yuklandi. Ilova xatosi emas, deploy oralig'i. Lekin pastdagi 1-kuzatuvga qarang. |
| A3.1 | Qo'llanma birinchi ochilishda o'zi chiqadi | ✅ | Studio ochilishi bilan, sahna hali «3D sahna yuklanmoqda… 67%» paytida, tepada **«Devor yoki polga bosing · 1/8 · O'tkazib yuborish»**. Rasm 05 chap. |
| A3.2 | Tur ochiq paytda ilovaning o'z Back tugmasi yashirin | ✅ | 1/8 … 8/8 davomida chap tepadagi «←» doirasi ko'rinmaydi (rasm 05, 08, 09). Tur yopilishi bilan qaytadi (rasm 06 o'ng, 09 o'ng). |
| A3.3 | 1/8 → 2/8 → mebel qo'shish | ✅ | Polga bosildi → **2/8 «Mebel qo'shing: Mebel → xona → buyum»**. Mebel → Yotoqxona → «Стол Dou…» → stol xonaga qo'yildi, tur o'zi **3/8 «Bosqichni almashtiring»** ga o'tdi. Rasm 05. |
| A3.4 | 3/8 da **tizim Back** (`adb shell input keyevent KEYCODE_BACK`) | ✅ | Bir bosishda: tur yopildi, **mashq stoli savolsiz olib tashlandi**, Studio'dan chiqilmadi, ilovaning «←» tugmasi qaytdi. 1 s keyingi kadrda ham hech qanday dialog yo'q. Rasm 06. |
| A3.5 | «?» bilan qayta boshlash | ✅ | «?» → yana 1/8, «←» yashirin. Rasm 05 bilan bir xil. |
| A3.6 | Oxirigacha o'tish, «Olib tashlash» faqat mashq buyumini oladi | ✅ | Tekshiruv uchun turdan oldin **oddiy buyum** (Oshxona bo'limidan qora dumaloq buyum) qo'shildi. «?» → 1/8 → 2/8 (stol qo'shildi) → 3/8 (Bosqich → «Suvoq») → 4/8 «Smeta va PDF shu yerda» → 5/8 «Oxirgi amalni bekor qilish» → 6/8 «Kamerani qotirish» → 7/8 «Tayyor kameralar va render» → **8/8 «Qo'llanmani istalgan payt qayta ko'ring» → «Tushunarli»**. Savol chiqdi: **«Mashqda qo'shilgan mebel qoldirilsinmi?» · Qoldirish / Olib tashlash**. Bosqich o'zi «Tayyor xona» ga qaytdi. «Olib tashlash» → stol yo'qoldi, oddiy buyum joyida qoldi, «✓ Saqlandi». Rasm 09. |
| A4 | Tur o'rtasida burish (emulyator, `user_rotation` 1 → 0) | ✅ | **3/8** (Bosqich chip), **4/8** (⋮ menyu) va **7/8** (Kameralar) da landshaftga va qaytib portretga burildi. Har safar qadam raqami saqlandi, nishon (spotlight) yangi joyidagi tugmani ko'rsatdi, qadam tashlab ketilmadi. iOS'da kuzatilgan «7/8 → 7/7» Android'da takrorlanmadi. Tur 8/8 gacha yetdi. Rasm 08. |
| A5 | Xonani o'chirish | ✅ | Tur yopiq holatda tizim Back → smeta sahifasiga qaytdi (normal). Uy → kartadagi ⋮ → «Loyihani o'chirish» → «O'chirish». Bosh sahifa yana «Birinchi xonangizni qo'shing». Rasm 10. |

## B. iPhone 16e (390 pt) landing natijalari

| # | Band | Til | Natija | Nima ko'rildi |
|---|---|---|---|---|
| B1 | Hero bir marta yig'iladi, «Qayta ko'rsatish» ishlaydi, yorliqlar kesilmaydi, gorizontal siljish yo'q | UZ | ✅ | Qayta yuklashdan keyin hero ~7 s da yig'ildi (pol → devorlar → mebel → yorliqlar → smeta), keyin o'zgarmay turdi (9 s va 12 s dagi kadrlar bir xil). **Gulqog'oz 9 rulon**, **Mebel 5 dona**, **Laminat 14.3 m²** yorliqlari to'liq, «Smeta (namuna) 3 912 400 so'm». «Qayta ko'rsatish» → reja chizmasi (4.20 m / 3.40 m) dan boshlab qayta yig'ildi, ~9 s da tugadi. Sahifa pastida chapga surilganda sahifa siljimadi. Rasm 11, 13 (oxirgi kadr). |
| B2 | Menyu/logo kesilmaydi; EN da logo til tugmasiga tegmaydi | UZ, EN | ✅ | UZ: ikonka + UZ/RU/EN + «Boshlash» bir qatorda. EN: ikonka bilan til tugmasi orasida ~100 pt bo'sh joy, «Get started» bir qatorda. Rasm 14. |
| B3 | Story sahnalarida pastki qatorlar kesilmaydi; reja sahnasida «… m», «undefined» yo'q | UZ | ✅ | 01 LiDAR (Nuqtalar 0 → 1 260), 03 reja → 3D (4.70 m, 2.10 m, 3.30 m, 1.10 m, 1.20 m, 3.60 m, «Maydon 14.2 m²»), 04 oboy (8 namuna, «Oboy Tropik barg · Rulon 9 ta · 2 412 000 so'm»), 05 deraza (Chapdan 2.85 m, O'ngdan 0.45 m), 06 mebel (Joylandi 5/6, Bo'sh joy 9.4 m²), 07 smeta (to'rt qator, «Jami 5 792 000», izoh). Hech qayerda «undefined» yo'q, pastki qatorlar butun. Rasm 12. |
| B4 | Paint-story kartalari ustma-ust emas; «Ishonchli ustalar» kesilmaydi; Solution va HowItWorks | UZ | ✅ | Kartalar zinapoya: 02 «Daqiqalarda reja», 04 **«Ishonchli ustalar»** (to'liq, matni o'qiladi), 01 «3D studiya», 03 «Aniq smeta», bir-birini yopmaydi. Solution: «Barchasi bitta ilovada», telefon maketi (3D skaner, ±1 sm, 14.2 m²) va ro'yxat. HowItWorks: «Uch qadamda», 1–3 qadam, rasmlar chiziladi. «Bepul boshlang · 0 so'm» kartasi ham to'g'ri. Rasm 13. |
| B5.1 | Hero, menyu | RU | ✅ | «Увидьте свою комнату в 3D до начала ремонта», menyu UZ/RU/EN + «Начать» bir qatorda. Hero yig'ildi: «Обои 9 рулонов», «Мебель 5 предметов», «Ламинат 14.3 м²», «Смета (пример) 3 912 400 сум», «Показать снова». Rasm 15 (1-kadr). |
| B5.2 | Story | RU | ✅ | 01 LiDAR (Точки 175), **02 чертёж: «1.15 м»**, «Стены 0/6, Площадь —» (undefined yo'q), 03 «Высота 0.89 м», 04 oboy: uzun nomlar («Тропические листья», «Деревянная панель») ikki qatorga o'raladi, kesilmaydi; «Рулон 9 рулонов · 2 682 000 сум». 05 «Слева 1.60 м, Справа 1.70 м», 06 «Размещено 5/6», 07 «Итого 5 786 201 → 5 792 000», izoh to'liq. Rasm 15. |
| B5.3 | Paint-story, Solution, HowItWorks | RU | ✅ | «План за минуты», «Проверенные мастера», «3D-студия», «Точная смета» ustma-ust emas, «Проверенные мастера» to'liq. «Всё в одном приложении», maket, ro'yxat («Дизайн-студия», «Точная смета», «Магазин», «Мастера», «Шаг за шагом»). «В три шага»: «Отсканируйте», «Спроектируйте», «Смета и покупка». Rasm 16. |

## Boshqa kuzatuvlar

1. **Deploy paytida Studio 502 ko'rsatadi, ilova buni tushuntirmaydi.** A2.5 da Studio WebView'da nginx'ning xom «502 Bad Gateway» sahifasi chiqdi, faqat «←» bor edi. Deploy bir necha daqiqa davom etsa, foydalanuvchi shu ingliz tilidagi texnik sahifani ko'radi. Ilovada «Server yangilanmoqda, birozdan keyin qayta urinib ko'ring» kabi o'z ekrani va «Qayta urinish» tugmasi bo'lsa yaxshi bo'lardi. Kichik, lekin deploy'lar tez-tez.
2. **Tur yopilgach «Bekor qilish» (undo) mashq stolini qaytaradi.** A3.4 dan keyin undo tugmasi faol edi. Bosilganda tizim Back olib tashlagan mashq stoli xonaga qaytdi (rasm 07). Redo bilan yana olib tashlandi. Ya'ni turning tozalashi oddiy amal sifatida tarixga yoziladi. Foydalanuvchi undo bosib, tushunmagan holda mashq mebelini qaytarishi mumkin. Kerak bo'lsa, tozalashni tarixga yozmaslik yoki tarixdan mashq qadamlarini ham olib tashlash mumkin.
3. **Kirish ekranidagi versiya eskirgan.** Kirish ekrani pastida «AndozaAI v1.0.0», ilova esa 1.0.3+36. Matn `lib/l10n/app_*.arb` dagi `loginVersion` kalitida qo'lda yozilgan (`andoza_ai_mobile`). `package_info_plus` dan olish yoki har relizda yangilash kerak.
4. **Bosh sahifa kartasida o'lchamlar «—».** Xona yaratilib, smeta ko'rilgandan keyin ham Uy'dagi «Yotoqxona» kartasida Maydon, 3D model, Smeta «—» va «Bosqich 1/8» (rasm 10 chap). Wizard xona 14.0 m² ekanini ko'rsatgan edi. Mehmonga xosmi yoki umumiy, aniqlanmadi.
5. **Mebel menyusida «Mehmon…» nomi kesilgan** (Mehmonxona bo'limi doirasida). Kichik.
6. **Landshaftda chap tomonda qora tasma** (emulyatorning tizim paneli/kesimi bo'lishi mumkin), Studio unga kirmaydi. Xato deb hisoblanmadi.
7. Story sahnasi pinned holatda sticky menyu ostiga tegib turadi (kartaning tepa burchagi menyu ostida). Kontent kesilmaydi, faqat ko'rinish.
8. Smeta ekranida (A2.3) yuqorida orqaga qaytish tugmasi yo'q, faqat tizim Back yoki pastki menyu bilan chiqiladi.

## Prod'da va qurilmalarda o'zgartirilgan narsalar

- Prod: mehmon akkaunti yaratildi (ilova o'zi, «Ro'yxatdan o'tmasdan davom etish»), unda «Yotoqxona» xonasi yaratildi va oxirida **o'chirildi**. Mehmon akkaunti 14 kundan keyin avtomatik tozalanadi.
- AI dizayner'ga matn yozildi, lekin so'rov ro'yxatdan o'tish oynasida to'xtadi, hech narsa yaratilmadi.
- Emulyator: ilova ma'lumotlari tozalandi, ilova tili O'zbekcha qilindi. Burish sozlamasi (`accelerometer_rotation=1`, `user_rotation=0`) boshidagidek tiklandi.
- iPhone 16e Safari: landing tili EN → UZ → EN → RU → **EN** (boshidagidek).

## Rasmlar

- [01 mehmon kirish](img/2026-11-23-and-01-mehmon-kirish.png)
- [02 xona va smeta eslatmasi](img/2026-11-23-and-02-xona-smeta-eslatma.png)
- [03 AI → ro'yxatdan o'tish oynasi](img/2026-11-23-and-03-ai-royxatdan-otish.png)
- [04 Studio 502 (deploy paytida)](img/2026-11-23-and-04-studio-502-deploy.png)
- [05 tur o'zi ochildi, mebel qo'shildi](img/2026-11-23-and-05-tur-ozi-ochildi-mebel.png)
- [06 tizim Back](img/2026-11-23-and-06-tizim-back.png)
- [07 undo mashq stolini qaytaradi](img/2026-11-23-and-07-undo-stol-qaytadi.png)
- [08 burish: 3/8, 4/8, 7/8](img/2026-11-23-and-08-burish-3-4-7.png)
- [09 8/8 va «Olib tashlash»](img/2026-11-23-and-09-yakun-olib-tashlash.png)
- [10 xona o'chirildi](img/2026-11-23-and-10-xona-ochirildi.png)
- [11 16e hero UZ](img/2026-11-23-and-11-16e-hero-uz.png)
- [12 16e story UZ](img/2026-11-23-and-12-16e-story-uz.png)
- [13 16e paint-story, Solution, HowItWorks UZ](img/2026-11-23-and-13-16e-paint-solution-uz.png)
- [14 16e menyu EN/UZ](img/2026-11-23-and-14-16e-en-menyu.png)
- [15 16e hero va story RU](img/2026-11-23-and-15-16e-ru-hero-story.png)
- [16 16e paint-story, Solution, HowItWorks RU](img/2026-11-23-and-16-16e-ru-paint-solution.png)
