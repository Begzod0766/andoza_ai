# Plitka ishlari va gidroizolyatsiya: mobil tekshiruv natijasi (2026-11-10)

Ro'yxat: [2026-11-10-plitka-gidro-mobil-tekshiruv.md](2026-11-10-plitka-gidro-mobil-tekshiruv.md).

**Muhit:**
- Qurilma: iOS Simulator, iPhone 17 Pro, iOS 26.
- Ilova: andoza_ai_mobile `main` (`5960db2`), versiya 1.0.0+31 (Play'dagi bilan bir xil).
- Server: production `andozaai.uz`, #224, #225, #226 deploy qilingandan keyin.
- Xona: "Hammom namunasi" → "Hammom" (2.5 × 2.0 m, vanna, dush, unitaz, rakovina). Plitkasiz xona: "Mening xonam".
- Til: English. 1.7, 3.6 va 3.7 Русский'da tekshirildi.

**Qamrov.** Asosan mobilga xos bandlar tekshirildi: doira menyu, panelga yetib borish, smetaning telefonda ko'rinishi, PDF yuklash. Smeta hisobi web'da qanday bo'lsa, ilovada ham shunday, shuning uchun 1.5, 3.3 va 3.5 qayta tekshirilmadi.

> ⭐ bandlar haqiqiy telefonda tasdiqlanmagan. Simulyatorda barmoq harakati sun'iy yuboriladi.

> "Hammom" xonasining B devoriga plitka (300×600, White marble) qo'yilgan holda qoldirildi, keyingi tekshiruvda kerak bo'ladi. Ilova tili yana English'ga qaytarildi.

## Qisqacha

| | Soni | Bandlar |
|---|---|---|
| ✅ | 10 | 1.2, 1.3, 1.4, 1.6, 1.7, 3.1, 3.2, 3.4, 3.6, 3.7 ⭐ (ru) |
| ⚠️ qisman | 1 | 1.1 |
| ❌ tekshirib bo'lmadi | 9 | 2.1–2.9: ilovada "Tile height" bo'limiga yo'l yo'q |
| tekshirilmadi | 3 | 1.5, 3.3, 3.5: web mantig'i, mobilga xos emas |

**Asosiysi:** devor plitkasining balandligi (2-bo'lim) ilovada umuman ochilmaydi, pastdagi 1-ishga qarang. Web uchun hammasi bo'lib 8 ta ish bor: [Web nima qilishi kerak](#web-nima-qilishi-kerak).

## Natijalar

| # | Natija |
|---|---|
| 1.1 | ⚠️ Devorni bosganda doira menyuda "Tile" bor ([rasm](img/2026-11-10-plitka-gidro/01-wall-ring.png)). 300×600 → White marble tanlanganda plitka bitta devorga tushadi ([rasm](img/2026-11-10-plitka-gidro/03-one-wall-tiled.png)). **Ikki marta bosib hamma devorga** qo'yishni simulyatorda tekshirib bo'lmaydi: ikki teginish orasi 350 ms dan oshib ketadi. Buni haqiqiy telefonda tekshirish kerak. Kamchilik: halqadagi yozuvlar chetidan kesilgan ("hite marb", "lack marb"), 6-ishga qarang ([rasm](img/2026-11-10-plitka-gidro/02-tile-labels-cut.png)) |
| 1.2 | ✅ "Wall finishing" bo'limida "Wall tile" qatori bor: "5.40 m² × 1.10 (waste) = 5.94 m² (wall B)". "AI price" belgisi yo'q. **Lekin** qator nomida tanlangan plitka emas, boshqa mahsulot chiqadi: "Керамогранит Geolam … 60х120см Tegal nero (Маттовый)". Tagida esa "No product is chosen" deb yozilgan, 2-ishga qarang ([rasm](img/2026-11-10-plitka-gidro/05-wall-tile-wrong-product.png)) |
| 1.3 | ✅ "Tile work / Плиточные работы" bo'limi bor. Tartib: Wall preparation, Wall finishing, Tile work, Electrics, Plumbing. Polga ishlov berilmagan, shuning uchun "Floor and skirting" bo'limi yo'q |
| 1.4 | ✅ "Tile adhesive": 2 bags (25 kg), "Grout": 2 pcs (2 kg), "Work: laying wall tile": 5.4 m² ([rasm](img/2026-11-10-plitka-gidro/06-tile-work-lines.png)). Kichik kamchilik: ishning formulasi ikki marta, ikki xil formatda yozilgan, 7-ishga qarang |
| 1.5 | tekshirilmadi (web mantig'i) |
| 1.6 | ✅ "Mening xonam" smetasida faqat "Electrics and lighting" bor: plitka ham, gidroizolyatsiya ham yo'q ([rasm](img/2026-11-10-plitka-gidro/08-living-room-no-tile.png)) |
| 1.7 | ✅ «Настенная плитка», «Плиточные работы», «Плиточный клей» (2 мешка), «Затирка» (2 шт.), «Работа: укладка настенной плитки» ([rasm](img/2026-11-10-plitka-gidro/10-ru-tile-work.png)) |
| 2.1–2.9 | ❌ "Tile height" bo'limiga ilovada yetib bo'lmaydi. Bu bo'lim faqat Paint (`boyoq`) bosqichi panelida chiqadi. Ilovada bosqichlar qatori yo'q, panelni faqat burchak menyusi yoki doira menyu ochadi. Ular esa Paint panelini faqat oboy ro'yxati bo'sh bo'lganda ochadi; production'da 113 ta oboy bor ([rasm](img/2026-11-10-plitka-gidro/09-arc-color-no-panel.png)). 1-ishga qarang. 2.2 ⭐ va 2.5 ⭐ ham shu sababli tekshirilmadi |
| 3.1 | ✅ "Waterproofing mastic" (23 kg), "Waterproofing tape" (12 m), "Work: waterproofing" (15.27 m²) ([rasm](img/2026-11-10-plitka-gidro/07-waterproofing-work.png)) |
| 3.2 | ✅ "Floor 5.00 m² + foot of the walls 1.66 m² + wet zone 8.61 m² = 15.27 m² × 1.5 kg/m² = 22.9 kg" → 23 kg |
| 3.3 | tekshirilmadi (web mantig'i) |
| 3.4 | ✅ "Mening xonam"da gidroizolyatsiya qatorlari yo'q (1.6 dagi rasm) |
| 3.5 | tekshirilmadi (web mantig'i) |
| 3.6 | ✅ «Гидроизоляционная мастика», «Гидроизоляционная лента», «Работа: гидроизоляция». Formulada «Пол 5.00 м² + низ стен 1.66 м² + мокрая зона 8.61 м²» |
| 3.7 ⭐ | ✅ simulyatorda, ru: "Скачать PDF" ulashish oynasini ochadi, fayl 106 KB ([rasm](img/2026-11-10-plitka-gidro/11-pdf-share-sheet.png)). PDF 4 sahifa, «Плиточные работы» bo'limi va 6 qatorning hammasi ruscha. Jihozlar nomi ham endi ruscha («Раковина 3», «Душ 2»). Ammo PDF'da 2 ta kamchilik bor (3- va 4-ishlar). en PDF alohida tekshirilmadi |

## Web nima qilishi kerak

1. **(Muhim) Ilovada devor plitkasining balandligini o'zgartirib bo'lmaydi.** `TileHeightControls` faqat `DesignPanel` → `phase === 'boyoq'` → `WallSection` ichida. Telefonda bu panelga yo'l yo'q:
   - ilovada bosqichlar qatori yo'q;
   - doira menyuda farzandlari bor element (`Color`, `Wallpaper`, `Tile`) bosilganda o'z `onSelect`'i ishlamaydi, faqat farzandlari ochiladi (`SurfaceRadialMenu.tsx`, ~307–323-qatorlar). Shuning uchun `openPaintPanel` hech qachon chaqirilmaydi;
   - burchak menyusidagi "Color" panelni faqat `emptyItem` orqali ochadi, ya'ni oboy bo'lmaganda (`useArcCategories.tsx:278`).

   Taklif: plitka tanlangandan keyin doira menyuda balandlik tugmalari chiqsin ("To the ceiling", "1.5 m", "1.8 m", "2.1 m"). Yoki "Tile" halqasining oxiriga panelni ochadigan tugma qo'shilsin, xuddi "+ Add a point" kabi.
2. **"Wall tile" qatorida tanlangan plitka emas, boshqa mahsulot ko'rinadi.** 300×600 White marble tanlangan, smetada esa "Керамогранит Geolam … 60х120см Tegal nero (Маттовый)". Tagida "No product is chosen: the shop's average price is used". Mahsulot tanlanmagan bo'lsa, umumiy nom ko'rsatilsin ("Wall tile 300×600, White marble") yoki o'lchami va yuzasi mos mahsulot olinsin. Bu PDF'da ham shunday.
3. **PDF'da "Кол-во" ustuni kasr qismini tashlab yuboradi.** `backend/app/routers/estimate.py:782` dagi `_fmt_num` `int(n)` qiladi va `:839` da miqdor uchun ham ishlatiladi. Natijada 5.94 m² → "5", 15.27 m² → "15", 8.68 m → "8", 23.94 m → "23". Jami summa to'g'ri hisoblanadi, faqat miqdor noto'g'ri ko'rinadi. Butun bo'lmagan miqdor 2 xona kasr bilan ko'rsatilsin.
4. **PDF'da "Фитинги" qatorida "11" va «комплектов» bir-birining ustiga chiqadi.** "Ед." ustuni tor. Qisqaroq birlik («компл.») yoki kengroq ustun kerak.
5. **Smetada izoh qatorlari qorong'i fonda deyarli ko'rinmaydi** ("Approximate price — …", "No product is chosen…", "of which approximate: ~3,681,260 UZS"). Ilovada smeta qorong'i mavzuda ochiladi, bu matnlarning rangi fonga juda yaqin ([rasm](img/2026-11-10-plitka-gidro/04-estimate-low-contrast.png), [rasm](img/2026-11-10-plitka-gidro/06-tile-work-lines.png)).
6. **Doira menyuda plitka o'lchami va yuzasi yozuvlari kesilgan:** "300×60", "hite marb", "lack marb", "rey marbl" ([rasm](img/2026-11-10-plitka-gidro/02-tile-labels-cut.png)).
7. **"Work: laying wall tile" formulasi ikki marta yozilgan:** "5.4 m² × 100,000 UZS" va tagida "5.40 m² × 100 000 UZS", raqamlar formati ham har xil. Bittasi yetadi.
8. **Ro'yxatni yangilash:** 2-bo'lim uchun "Tile height"ga telefonda qanday kirilishini yozish (1-ish tuzatilgandan keyin). 1.1 dagi "ikki marta bosish" faqat haqiqiy telefonda tekshiriladi deb belgilash.

## Mobil tomonda qolgan ish

Bosh sahifadagi "Hammom namunasi" kartasida smeta **22.8M**, Studio smetasida esa **19 043 010 so'm**. Karta ilovaning o'z taxminiy hisobini ko'rsatadi (`roomEstimateTotalProvider`), u santexnika nuqtalari va plitkani bilmaydi. Bu web emas, mobil tomonning ishi.
