# 3D Studio tuzatishlari: mobil tekshiruv natijasi (2026-11-06)

Ro'yxat: [2026-11-06-studio-tuzatishlar-mobil-tekshiruv.md](2026-11-06-studio-tuzatishlar-mobil-tekshiruv.md).

**Muhit (hamma bandlar uchun):**
- Qurilma: iOS Simulator, iPhone 17 Pro, iOS 26.
- Ilova: andoza_ai_mobile `main` (`50468bf`), versiya 1.0.0+29.
- Server: production `andozaai.uz`.
- Xona: "Mening xonam" (16,2 m²), loyiha "Mening uyim".
- Til: English; 3.4 va 6.3 Русский'da ham tekshirildi.

> ⭐ bandlar **haqiqiy telefonda tekshirilmagan**. Simulyatorda barmoq harakatlari sun'iy yuboriladi, shuning uchun ularning natijasi faqat dastlabki baho, telefonda qayta ko'rish kerak.

## Qisqacha

| | Soni | Bandlar |
|---|---|---|
| ✅ | 28 | qolganlari |
| ⚠️ qisman | 4 | 1.2, 1.10, 2.5, 4.4 |
| ❌ | 3 | 2.4 ⭐, 2.6, 6.6 ⭐ |
| tekshirilmadi | 2 | 2.7 ⭐, 4.2 |

## 1. Kamera, render va pastki panel

| # | Natija |
|---|---|
| 1.1 | ✅ |
| 1.2 | ⚠️ Kamera va qulf tugmalari joyida qoladi. Lekin ochilgan ro'yxatdagi "360" qatori "My renders" tugmasini, ro'yxat esa 9:16 tugmasi va ishorani yopib qo'yadi ([rasm](img/2026-11-06/1.2-camera-list-overlap.jpg)) |
| 1.3 | ✅ |
| 1.4 ⭐ | ✅ simulyatorda: "Camera 3 picture" rasm bilan ochildi, Save iOS ulashish oynasini ochdi ([rasm](img/2026-11-06/1.4-share-sheet.jpg)). Kichik: inglizcha interfeysda fayl nomi "kamera3" |
| 1.5 | ✅ |
| 1.6 | ✅ |
| 1.7 | ✅ |
| 1.8 | ✅ |
| 1.9 ⭐ | ✅ simulyatorda (~180°) |
| 1.10 | ⚠️ Kvartira markazda. Xonalar bir-biriga kirib turganga o'xshaydi, lekin "Some rooms overlap…" ishorasi chiqmadi ([rasm](img/2026-11-06/1.10-flat.jpg)) |

## 2. Gestlar

| # | Natija |
|---|---|
| 2.1 ⭐ | ✅ simulyatorda |
| 2.2 ⭐ | ✅ simulyatorda |
| 2.3 ⭐ | ✅ simulyatorda |
| 2.4 ⭐ | ❌ simulyatorda: toast yoki aylana menyu yopilgandan keyingi birinchi sudrash hali ham e'tiborga olinmaydi. Telefonda tasdiqlash kerak |
| 2.5 ⭐ | ⚠️ simulyatorda: mebel barmoq ortidan yuradi, lekin bir sinovda kreslo o'zi ~20 sm chapga siljidi |
| 2.6 | ❌ Eshik yonidagi devorni uzoqdan bosganda toifalar emas, darhol eshik modellari ochiladi ([rasm](img/2026-11-06/2.6-wall-near-door-opens-doors.jpg)) |
| 2.7 ⭐ | tekshirilmadi |

## 3. Menyular va nomlar

| # | Natija |
|---|---|
| 3.1 | ✅ |
| 3.2 | ✅ |
| 3.3 | ✅ Kichik: ⛶ (to'liq ekran) tugmasi ochilgan bosqichlar ro'yxatining ustiga tushadi |
| 3.4 | ✅ "Delete room" / "Удалить комнату" |

## 4. Mebel va chiroq

| # | Natija |
|---|---|
| 4.1 | ✅ TV uzun devorga tushdi; tashqaridan orqasi ko'rinishi 7-bo'limdagi ma'lum masala. Sinovdan keyin o'chirildi |
| 4.2 | tekshirilmadi |
| 4.3 | ✅ |
| 4.4 | ⚠️ 90°, −, + ishlaydi. Lekin burish rad etilganda chiqadigan toast "My renders" tugmasi ostida qoladi va o'qib bo'lmaydi ([rasm](img/2026-11-06/4.4-rotate-toast-unreadable.jpg)) |
| 4.5 ⭐ | ✅ simulyatorda |
| 4.6 | ✅ Yangi qandil mavjud chiroqdan nariga tushdi. Sinovdan keyin o'chirildi |
| 4.7 | ✅ |

## 5. Xona ko'rinishi

| # | Natija |
|---|---|
| 5.1 | ✅ |
| 5.2 | ✅ (ko'z bilan, yaqindan o'lchab tekshirilmadi) |
| 5.3 | ✅ ma'lum, xato deb yozilmadi |

## 6. Smeta

| # | Natija |
|---|---|
| 6.1 | ✅ |
| 6.2 | ✅ |
| 6.3 | ✅ |
| 6.4 | ✅ |
| 6.5 | ✅ |
| 6.6 ⭐ | ❌ iOS ilovada "Download PDF" bosilganda hech narsa bo'lmaydi ([rasm](img/2026-11-06/6.6-download-pdf-nothing.jpg)). Sabab mobil tomonda: WKWebView fayl yuklashni qo'llab-quvvatlamaydi va ilovada (`studio_webview_screen.dart`) yuklash ishlovchisi yo'q. Kamera rasmi esa ulashish oynasi orqali saqlanadi, demak PDF uchun ham shu yo'l kerak. PDF ichidagi til va ruscha harflar shuning uchun tekshirilmadi |

## ❌ va ⚠️ bandlar tafsiloti

### 2.6 Eshik yonidagi devor eshik modellarini ochadi
**Qadamlar:** Studio → xonani tashqaridan, uzoqdan ko'ring → eshik romiga yaqin joyda devorni bosing.
**Natija:** Door modellari ro'yxati ochiladi.
**Kutilgan:** avval toifalar (Color, Wallpaper, Window, Door…).

### 6.6 Download PDF iOS'da ishlamaydi
**Qadamlar:** Studio → Estimate → Download PDF.
**Natija:** hech narsa bo'lmaydi, xato ham ko'rsatilmaydi.
**Taklif:** mobil ilovada tuzatiladi: PDF'ni JS kanal orqali olib ulashish oynasini ochish, yoki Studio iOS ilova ichida ekanini bilsa `navigator.share` bilan faylni berish.

### 2.4 Birinchi sudrash yo'qoladi (simulyator)
**Qadamlar:** mebelni burib toast chiqaring yoki aylana menyuni yoping → darhol xonani sudrang.
**Natija:** birinchi sudrash ishlamaydi, ikkinchisi ishlaydi.

### 1.2 / 4.4 Pastki paneldagi ustma-ustlik
Kamera ro'yxati va rad etish toasti "My renders" tugmasi bilan bir joyga tushadi. Ikkalasi ham bitta joylashuv masalasi.

### 1.10 Flat'da ustma-ustlik ishorasi chiqmadi
Xonalar bir-biriga kirib turganga o'xshaydi, ishora yo'q. Ehtimol kesishuv chegaradan kichik: tekshirib ko'ring.

## Qo'shimcha topilmalar (ro'yxatda yo'q)
- Mobil ilova, Русский: xona kartochkasidagi "SKAN" belgisi tarjima qilinmagan (mobil tomonda tuzatiladi).
- 7-bo'limdagi QA #20 (Qibla) va QA #21 (Room type) qayta tekshirilmadi.
