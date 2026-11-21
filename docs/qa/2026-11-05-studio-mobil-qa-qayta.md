# QA qayta tekshiruv — 3D Studio mobil ilovada (2026-11-05, kechqurun)

**Muhit:**
- Qurilma: iOS Simulator (iPhone 17 Pro, iOS 26).
- Ilova: andoza_ai_mobile `main`.
- Server: production `andozaai.uz`, #149–#160 tuzatishlari deploy qilingandan keyin.
- Xona: "Mening xonam" (16,2 m²).

**Usul:** demo video uchun Studio'ning barcha imkoniyatlari noldan qayta ishlatildi: dizaynni tozalash, AI designer, gulqog'oz, devor rangi, parket, chiroq, mebel qo'shish va burish, kameralar, 360° va realistik render, Flat, smeta. Avvalgi hisobot: [2026-11-05-studio-mobil-qa.md](2026-11-05-studio-mobil-qa.md).

## Tuzatilgani tasdiqlandi

| Avvalgi # | Natija |
|---|---|
| 1 | 360° kamerada Render tugmasi ko'rinadi va bosiladi |
| 2 | 360° kamera xona ichida (lekin pastdagi 7-bandga qarang) |
| 5 | Kichik mebel (kreslo) bo'sh joyga tushadi |
| 7, 8 | Devor bosilganda toifalar menyusi ochiladi, bitta bosish tanlaydi |
| 10 | Dizayndan keyin shift xonani yuqoridan yopmaydi |
| 12, 13 | Smeta 3D'dagi pol turini aytadi, satr nomlari inglizcha |

## Hali ham bor yoki yangi xatolar

| # | Jiddiylik | Qayerda | Muammo |
|---|---|---|---|
| 1 | 🔴 Yuqori | AI designer / Mebel | Neoclassical uslubi va "Televizor 2" (3,04 × 0,37 m) qo'shilganda TV bloki xona o'rtasiga, orqasi bilan tushadi va xonani ikkiga bo'ladi (avvalgi #3 tuzalmagan) |
| 2 | 🔴 Yuqori | Kamera 1–4 | Render tugmasi ko'rinadi, lekin bosilganda hech narsa bo'lmaydi; render faqat 360° dan ishlaydi |
| 3 | 🟠 O'rta | Pastki panel | "My renders" tugmasi "Flat" tugmasi ostiga kirib qolgan (yangi) |
| 4 | 🟠 O'rta | My renders | "My renders (3)" bo'sh "The result will appear here" oynasini ochadi; saqlangan renderlar faqat yangi render oynasida ko'rinadi |
| 5 | 🟠 O'rta | Kamera ro'yxati | Ro'yxat ochilganda pastki panel joylashuvi o'zgaradi, tugmalar joyi sakraydi |
| 6 | 🟠 O'rta | Chiroq qo'shish | Yangi qandil mavjud osma chiroq bilan bir joyga tushadi (ustma-ust) |
| 7 | 🟠 O'rta | 360° kamera | Kamera devorga yaqin, devorga qarab ochiladi |
| 8 | 🟠 O'rta | Gestlar | Toast yoki aylana menyu yopilgandan keyingi birinchi sudrash/bosish e'tiborga olinmaydi |
| 9 | 🟠 O'rta | Gestlar | Pinch-zoom juda sezgir (kichik harakat polga "uchib kiradi"); buyum ustida pinch uni tanlab yuboradi |
| 10 | 🟠 O'rta | Smeta | Inglizcha interfeysda formulalarda o'zbekcha so'zlar: "devor", "qatlam", "isrof", "polosa", "rulon", "qop" |
| 11 | 🟡 Past | Smeta | Kulrang izoh matnlari juda past kontrastli; yuklanayotganda pol ogohlantirishi matni boshqasiga almashadi |
| 12 | 🟡 Past | Pol / Smeta | Chevron parket uchun do'konda mahsulot yo'q, pol "taxminiy" narxlanadi |
| 13 | 🟡 Past | Eshiklar | Bitta devorda yonma-yon ikkita eshik romi (avvalgi #22) |
| 14 | 🟡 Past | Mebelni o'chirish | Bosib turishda nom yorlig'i kartochka ustiga tushadi (avvalgi #16) |
| 15 | 🟡 Past | Flat | Kvartira ekran markazida emas, o'ngga siljigan (avvalgi #9 qisman) |

## Tafsilotlar

### 1. TV bloki xona o'rtasida
**Qadamlar:** ⋮ → AI designer → Neoclassical; yoki ↖ → Furniture → Living room → "Televizor 2".
**Natija:** 3,04 m eni 2,95 m qisqa devorga sig'maydi, blok xona o'rtasida orqasi bilan turadi.
**Kutilgan:** uzun (5,5 m) devorga, old tomoni xonaga qaragan holda qo'yilsin; sig'masa ogohlantirish chiqsin.

### 2. Kamera 1–4 da Render ishlamaydi
**Qadamlar:** kamera → Camera 3 → Render.
**Natija:** hech narsa bo'lmaydi. "My renders" oynasida "Pick the 360 camera — a new render is taken from it" yozuvi bor.
**Kutilgan:** tugma o'chirilgan ko'rinsin va sababini aytsin, yoki shu kameradan render qilinsin.

### 3–5. Pastki panel
"My renders" tugmasi qo'shilgandan keyin "Flat" bilan ustma-ust tushadi. Kamera ro'yxati ochilganda "My renders" pastki qatorga ko'chadi va tugmalar joyi o'zgaradi, natijada bir xil joyni bosish turli tugmaga tushadi.

### 8–9. Gestlar (simulyatorda)
Barmoq harakati simulyatorda sun'iy yuboriladi. 8- va 9-bandlarni haqiqiy telefonda qayta tekshirish kerak.
