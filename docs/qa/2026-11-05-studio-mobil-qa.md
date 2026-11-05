# QA hisoboti — 3D Studio mobil ilovada (2026-11-05)

**Muhit:**
- Qurilma: iOS Simulator (iPhone 17 Pro, iOS 26).
- Ilova: andoza_ai_mobile `main`, Studio tuzatishi bilan (andoza_ai_mobile PR #51).
- Server: production `andozaai.uz`.
- Xona: LiDAR'da skaner qilingan "Mening xonam", 16,2 m², eshik va deraza bor (`41a04c06-2200-4983-8146-60741f4a2ef6`).

**Usul:**
- Studio'ning telefonda bosish bilan ochiladigan barcha imkoniyatlari ketma-ket ishlatib chiqildi: burchak menyusi, devor/pol/shift menyulari, AI designer, mebel, kameralar, Flat, Qibla, smeta.
- Har bir qadam ekrandan yozildi.
- Simulyatorda barmoq harakati sun'iy yuboriladi. Shuning uchun **#4** (sudrash) haqiqiy telefonda qayta tekshirilishi kerak. Qolganlari simulyatorga bog'liq emas.

**Yaxshi tomoni:** asosiy oqim ishlaydi. Xona ochiladi, AI designer'ning tayyor uslublari bir bosishda devor, pol, chiroq va mebelni qo'yadi, "Undo" hammasini qaytaradi. Devor rangi, gulqog'oz, parket naqshi, plintus, karniz va chiroq qo'shish ishlaydi. Har bir o'zgarish "Saved" bilan saqlanadi. Mebel kartochkasi o'lcham va narxni ko'rsatadi. 1–4-kameralar xona ichidan chiroyli ko'rinish beradi, smeta material va do'konlargacha batafsil.

---

## Xulosa jadvali

| # | Jiddiylik | Qayerda | Muammo |
|---|---|---|---|
| 1 | 🔴 Yuqori | Kamera / Render | Telefonda "Render" tugmasini bosib bo'lmaydi — ustidan "Flat" va ↖ tugmalari yopib turadi |
| 2 | 🔴 Yuqori | 360° kamera | Kamera xona markazida emas, burchakdagi tor joyda; mebel/eshik/deraza ko'rinmaydi, pol deyarli qora |
| 3 | 🔴 Yuqori | AI designer (Neoclassical) | TV devor bloki xona o'rtasiga qo'yiladi va shiftdan tepaga chiqib ketadi |
| 4 | 🔴 Yuqori | Mebel | Tanlangan mebelni barmoq bilan sudrab bo'lmaydi (iOS WebView) |
| 5 | 🟠 O'rta | Mebel qo'shish | Yangi mebel har doim xona o'rtasiga, boshqa mebel ustiga tushadi |
| 6 | 🟠 O'rta | Gestlar | Ikki barmoq bilan kattalashtirish devor menyusini ham ochib yuboradi |
| 7 | 🟠 O'rta | Aylana menyular | Chetdagi elementni bosish uni tanlamaydi, faqat aylanani buradi — har tanlov 2 bosish |
| 8 | 🟠 O'rta | Devor menyusi | Birinchi bosishda menyu "Door" modellari bilan ochildi, toifalarga qaytish noaniq |
| 9 | 🟠 O'rta | Flat ko'rinish | Xonalar bir-birining ustiga chiqib turadi; kvartira ekran markazida emas |
| 10 | 🟠 O'rta | Standart ko'rinish | Dizayndan keyin shift paydo bo'lib, yuqoridan qaraganda xonaning yarmini yopadi |
| 11 | 🟠 O'rta | Xona geometriyasi | Pol eshik yonida devor chizig'idan tashqariga chiqib turadi |
| 12 | 🟠 O'rta | Smeta | 3D'da parket tanlansa ham "polga mahsulot tanlanmagan, narx taxminiy" deyiladi |
| 13 | 🟠 O'rta | Smeta | Inglizcha interfeysda o'zbekcha/ruscha yozuvlar: "Suvoq:", "Grunt:", "Shpatlyovka:", "qop" |
| 14 | 🟡 Past | Mebel | Aylantirish/o'lcham faqat sudrash bilan; "90° burish" kabi tugma yo'q |
| 15 | 🟡 Past | ⋮ menyu | "Delete" butun xonani o'chiradi — nomi va joyi chalg'itadi |
| 16 | 🟡 Past | Mebelni o'chirish | Bosib turishda chiqadigan nom yorlig'i kartochka sarlavhasi ustiga tushadi |
| 17 | 🟡 Past | Bosqichlar | Tepadagi "Paint/Wallpaper" yozuvi har doim bir xil, telefonda bosqichni tanlab bo'lmaydi |
| 18 | 🟡 Past | Kameralar | 1–4-kamerada sudrash hech narsa qilmaydi va bu haqida ishora yo'q; 360° juda sekin buriladi |
| 19 | 🟡 Past | Burchak menyu | "1/6", "1/21", "1/113" hisoblagichlari nimani bildirishi tushunarsiz |
| 20 | ⚪ Taxmin | Qibla | Yoqilgan Qibla keyinroq menyuni ochganda o'chiq ko'rindi |
| 21 | ⚪ Taxmin | AI designer | "Room type" tanlovi bosganda ochilmadi |
| 22 | ⚪ Taxmin | Eshiklar | 1-kamerada yashil devor burchagida yonma-yon ikkita eshik romi ko'rindi |
| 23 | ℹ️ Tuzatildi (mobil) | Studio yuklanishi | iOS'da Studio umuman ochilmasdi; sabab web'dagi `staleChunkReload` |

---

## Tafsilotlar

### 🔴 1. "Render" tugmasiga yetib bo'lmaydi
**Qadamlar:**
1. Kamera tugmasini bosing.
2. "Camera 1" (yoki "360") ni tanlang.

**Natija:** pastki qatorda "9:16 | 1…" va "Render" tugmalari chiqadi, lekin ularning ustini "Flat" tugmasi va o'ngdagi ↖ (burchak menyu) tugmasi to'liq yopadi. "Render" ning faqat 2–3 harfi ko'rinadi, bosish hech narsa qilmaydi.

**Kutilgan:** kamera rejimida "Flat" va ↖ yashirinsin, yoki render qatori ularning ustiga/tepasiga chiqsin.

**Qayerdan qarash** (`frontend/src/` ichida): `pages/studio/ThreeDPage.tsx` (kamera ro'yxati va Render, ~968–1083), `pages/studio/three-d/FlatToggle.tsx`, `components/studio/QuarterArcMenu.tsx`.

### 🔴 2. 360° kamera noto'g'ri joyda
**Qadamlar:**
1. Kamera tugmasini bosing.
2. "360" ni tanlang.
3. Atrofga burilib qarang.

**Natija:**
- Kamera devorga juda yaqin, xonaning burchagidagi tor joyda turadi. Bu xonada pol eshik yonida chiqib turadi (#11), kamera o'sha joyga tushgan bo'lishi mumkin.
- Uch tomonda faqat devor va gulqog'oz ko'rinadi. Divan, kreslo, gilam, eshik va deraza 360° dan ko'rinmaydi.
- Pol deyarli qora, plintus ko'rinmaydi.

**Kutilgan:** kamera xonaning bo'sh, ichki markazida, ko'z balandligida tursin. Ichki yoritish 1–4-kameralardagidek bo'lsin, ularda pol yorug' va to'g'ri chiqadi.

**Qayerdan qarash:** `lib/roomCameras.ts` (360 kamera joyi, ~292–301). Markaz hisobi notekis (L-shaklli) polda xonadan tashqariga yoki tor joyga tushmasligi kerak.

### 🔴 3. Neoclassical uslubida TV bloki shiftdan chiqib ketadi
**Qadamlar:**
1. ⋮ menyusidan "AI designer" ni oching.
2. "Neoclassical" ni tanlang.

**Natija:**
- Katta qora TV devor bloki (TV + yog'och panel) xonaning o'rtasiga, kameraga yaqin tomonga qo'yiladi.
- Uning tepasi shiftdan baland chiqib, shift tekisligini kesib o'tadi. Foydalanuvchi ham TV modeli shiftdan tepaga chiqib ketganini alohida ko'rgan.
- Xona ko'rinmay qoladi.

**Kutilgan:**
- Uslubdagi mebel devorga taqab qo'yilsin.
- Balandligi xona balandligiga sig'magan model kichraytirilsin yoki qo'yilmasin. Bu xonada shift 2,4 m.

**Qayerdan qarash:** `components/studio/AiBuilderSheet.tsx` (tayyor uslublar, ~320–334) va uslub mebelini joylashtirish. Model balandligi bilan `ceilingHeight` solishtirilmayapti.

### 🔴 4. Mebelni sudrab bo'lmaydi
**Qadamlar:**
1. Qulf ochiq turgan holatda mebelni bir marta bosing. U tanlanadi: ko'k ramka, kartochka, chapda Select / Rotate / Size paneli.
2. Shu mebelni yana bosib, barmoqni suring.

**Natija:**
- Mebel joyidan qimirlamaydi. Sekin, tez va bosib turib sudrash sinab ko'rildi.
- Shu paytning o'zida kamerani aylantirish (orbit) sudrash bilan ishlaydi, demak barmoq harakatlari kanvasga yetib boradi.

**Kutilgan:** tanlangan mebel barmoq ortidan pol bo'ylab yursin.

**Eslatma:**
- Simulyatorda tekshirildi. Haqiqiy iPhone/Android'da qayta tekshirish kerak.
- Agar u yerda ham ishlamasa, mobil foydalanuvchi mebelni umuman joylashtira olmaydi (#5 bilan birga).

**Qayerdan qarash:** `features/studio/StudioFurniture.tsx`:
- `activateDrag` va ikkinchi bosish mantiqi (~785–851);
- `pointermove`/`pointerup` `window` ga ulanadi (~949–960). iOS WKWebView'da barmoq bilan bosilganda pointer capture kanvasda qoladimi, shuni tekshirish kerak.

### 🟠 5. Yangi mebel har doim o'rtaga va ustma-ust tushadi
Burchak menyudan qo'shilgan har bir buyum xonaning markaziga qo'yiladi va boshqa buyumlar bilan to'qnashuv tekshirilmaydi. Masalan, shkaf karavotning ichiga, ish stoli esa uning orqasiga tushdi. #4 ishlamasa, buni to'g'rilashning yo'li yo'q: faqat o'chirib qayta qo'shish mumkin.

**Taklif:** qo'shishda bo'sh joy qidirilsin, mebel devorga orqasi bilan taqalsin, eshik va deraza oldi chetlab o'tilsin.

**Qayerdan qarash:** `lib/placement.ts` (~64–75), `lib/furnitureBounds.ts` (~170–200).

### 🟠 6. Kattalashtirish devor menyusini ochadi
Ikki barmoq bilan kattalashtirilganda (pinch) birinchi barmoq tegishi devorni "bosish" deb qabul qilinib, devor menyusi (Color / Wallpaper / Tile / Window / Door) ochiladi. Ikki barmoqli gest boshlanganda bosish bekor qilinishi kerak.

### 🟠 7. Aylana menyuda har tanlov ikki bosish
Devor menyusida va rang tanlashda chetdagi kichik elementni bosganda u tanlanmaydi, aylana faqat bir qadam buriladi. Kerakli rang yoki toifani tanlash uchun 2–3 marta bosish kerak, bu ko'pincha "menyu ishlamayapti" degan taassurot qoldiradi. Ko'rinib turgan har qanday elementni bosish darhol tanlasin.

### 🟠 8. Devor menyusi "Door" modellari bilan ochildi
Uzoqdan devorni birinchi marta bosganda menyu darhol eshik modellari (MY-P006, MY-P009…) va "Door" yorlig'i bilan ochildi. Toifalarga (Color, Wallpaper…) qanday qaytish noaniq: surish eshiklar ro'yxatini aylantirdi. Yaqindan bosganda esa toifalar to'g'ri chiqdi. Ehtimol bosish eshik/devor chegarasiga tushgan, lekin foydalanuvchi buni tushunmaydi. Har doim avval toifalar chiqsin.

### 🟠 9. Flat ko'rinishda xonalar ustma-ust
"Flat" bosilganda 3 ta xona ko'rinadi, lekin "Mening xonam" va ikkinchi "Mening xonam" devorlari bir-birini kesib o'tadi. Kvartira ekranning o'ng tomoniga siljigan va kichik. Kamera kvartiraning chegarasiga moslashsin; skaner qilingan xonalar bir-biriga kirib ketmasin yoki foydalanuvchiga joylashtirishni so'rasin.

### 🟠 10. Shift xonani yopadi
Bo'sh xonada standart ko'rinishda shift chizilmaydi. AI uslubidan keyin shift (karniz bilan) paydo bo'ladi va yuqori burchakdan qaraganda xonaning yuqori yarmini yopadi, mebel ham qisman ko'rinmay qoladi. Kamera xonadan tashqarida va tepada bo'lganda shift (va yaqin devor) yashirilsin.

### 🟠 11. Pol devor tashqarisiga chiqadi
Bu skaner qilingan xonada eshik yonida pol devor chizig'idan tashqariga, zinapoya ko'rinishida chiqib turadi. Bu barcha ko'rinishlarda va parket qo'yilganda ham aniq ko'rinadi. Pol konturi devorlar bilan bir xil bo'lsin; eshik o'yig'i bo'lsa, ostona sifatida chizilsin.

### 🟠 12. Parket tanlansa ham smeta "taxminiy"
3D'da "Floor → Parquet → Chevron" tanlangan, lekin smeta "No product is chosen for the floor; the price is taken from the shop's average floor (approximate)" deydi. Naqsh tanlash mahsulot tanlash emas, lekin foydalanuvchi uchun ikkalasi bir xil narsa. Naqsh tanlanganda shu naqshdagi mahsulot taklif qilinsin, yoki 3D menyuda "do'kondan tanlash" ko'rsatilsin.

### 🟠 13. Smetada aralash til
Ilova inglizcha bo'lsa ham smeta qatorlarida o'zbekcha va ruscha yozuvlar chiqadi:
- "Suvoq: VENTUM… Гипсовая штукатурка", "Grunt:", "Shpatlyovka:", "Bo'yoq:";
- o'lchov birligi "13 qop".

Bo'lim nomlari va birliklar tilga qarab tarjima qilinsin. Mahsulot nomi do'kon tilida qolishi mumkin.

### 🟡 14–19. Mayda noqulayliklar
- **14:** Rotate/Size faqat tutqichni sudrash bilan ishlaydi (5° qadam). Telefonda "90° burish" va "+/−" tugmalari kerak, ayniqsa #4 bilan birga.
- **15:** ⋮ dagi "Delete" butun xonani o'chiradi (tasdiq so'raydi). Mebel tanlangan paytda bu "mebelni o'chirish" deb tushunilishi mumkin. Nomi "Xonani o'chirish" bo'lsin.
- **16:** Mebel 1 soniya bosib turilganda chiqadigan nom yorlig'i ("Shkaf 1") kartochkadagi "Shkaf 1" sarlavhasining ustiga tushadi.
- **17:** Tepadagi pill doim "… · Paint/Wallpaper". Telefonda bosqichlar ro'yxati yashirin (`hidden lg:flex`), pill esa bosilmaydi. Foydalanuvchi qaysi bosqichda ekanini va keyingisiga qanday o'tishni bilmaydi.
- **18:** 1–4-kameralarda sudrash hech narsa qilmaydi (kamera qotirilgan) va bu haqida ishora yo'q. 360° da to'liq ekran bo'ylab surish ham kichik burilish beradi.
- **19:** "1/6", "1/21", "1/113" aylana menyuda nimani bildirishi tushunarsiz: sahifa emas, aylanadagi joy ekan.

### ⚪ 20–22. Tasdiqlanmagan (qayta tekshirish kerak)
- **20:** Qibla 17:31 da yoqildi (Toshkent, 240°). 17:44 da ⋮ menyu qayta ochilganda o'chiq ko'rindi. Holat saqlanmaydimi yoki sessiyagagina tegishlimi, aniqlash kerak.
- **21:** AI designer'dagi "Room type" (`<select>`) bosilganda iOS tanlov oynasi ochilmadi (1,5 soniya kutildi).
- **22:** 1-kamerada yashil devor burchagida ikkita eshik romi yonma-yon ko'rindi. Skanerdan kelgan eshik ikki marta yozilgan bo'lishi mumkin.

### ℹ️ 23. iOS'da Studio ochilmasdi (mobil tomonda tuzatildi)
**Sabab:**
1. Ilova avval `/` sahifani ochib localStorage'ga auth yozardi, keyin `/studio/<id>` ga o'tardi.
2. `/` dagi React ilova hali chunk'larni yuklayotgan bo'ladi. Navigatsiya ularni uzadi va `vite:preloadError` chiqadi.
3. `lib/staleChunkReload.ts` buni "eski build" deb `location.reload()` qiladi.
4. Bu reload Studio'ga o'tishni bekor qiladi (`-999`). Ekranda "Studio failed to load:" chiqardi yoki /projects ochilardi.

**Holati:** mobil tomonda (andoza_ai_mobile PR #51) boshlang'ich sahifa `/favicon.svg` ga almashtirildi.

**Web uchun taklif:** `staleChunkReload` sahifa yopilayotgan/navigatsiya qilinayotgan paytda ishlamasin (`pagehide`/`beforeunload` dan keyin `vite:preloadError` e'tiborsiz qolsin). Aks holda brauzerda ham tez bosilgan havola qayta yuklanish bilan bekor qilinishi mumkin.
