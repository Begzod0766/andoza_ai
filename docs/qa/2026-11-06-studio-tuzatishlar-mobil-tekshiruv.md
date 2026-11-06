# 3D Studio tuzatishlari: mobil ilovada tekshirish ro'yxati (2026-11-06)

**Kimga:** mobil tomon (andoza_ai_mobile) — iOS / Android'da qayta tekshirish uchun.
**Server:** production `andozaai.uz`, quyidagi PR'lar merge va deploy qilingan (oxirgi deploy `d6f44da3`).
**Manba hisobotlar:** [2026-11-05-studio-mobil-qa.md](2026-11-05-studio-mobil-qa.md) va qayta tekshiruv `2026-11-05-studio-mobil-qa-qayta.md` (PR #161). Pastda "QA #N" — birinchi hisobot, "R#N" — qayta tekshiruv raqami.
**Sinov xonasi:** "Mening xonam" (16,2 m², shift 2,4 m, LiDAR skan, ikki eshik + deraza).

> **Muhim:** quyidagi hamma narsa web tomonda avtomatik testlar va prod brauzerida (375 px) tekshirilgan. ⭐ belgili bandlar faqat **haqiqiy telefonda** tasdiqlanishi mumkin — ularni birinchi navbatda ko'ring.

## Tekshirishdan oldin
1. Ilovani to'liq yoping va qayta oching (WebView keshi yangilansin).
2. Ilova tili: avval **English**, keyin **Русский** (tarjimalarni ko'rish uchun).
3. Har bir bandda: **Natija** ustuniga ✅ / ❌ va izoh yozing. ❌ bo'lsa skrinshot + qadamlar.

---

## 1. Kamera, render va pastki panel

| # | Qayerda | Qadamlar | Kutilgan natija | PR | Natija |
|---|---|---|---|---|---|
| 1.1 | Pastki panel | Studio'ni oching | "My renders (N)" tugmasi yuqori qatorda; "Flat" va ↖ tugmalari ostida hech narsa yo'q | #164 (R3) | |
| 1.2 | Kamera ro'yxati | Kamera tugmasini bosing | Ro'yxat tugma ustida suzib chiqadi; kamera va qulf tugmalari joyidan **qimirlamaydi** | #164 (R5) | |
| 1.3 | Kamera rejimi | Camera 1 ni tanlang | "Flat" va ↖ yashirinadi; "Render" to'liq ko'rinadi va bosiladi | #149 (QA #1) | |
| 1.4 ⭐ | Render, Camera 1–4 | Camera 3 → Render | "Camera 3 picture" oynasi rasm bilan ochiladi; **Save** telefonning ulashish (share) oynasini ochadi yoki rasmni bosib turib saqlash mumkin | #164 (R2) | |
| 1.5 | Ishora | Camera 1–4 tanlangan | "This camera is fixed — pick 360 to look around" yozuvi | #164 (QA #18) | |
| 1.6 | My renders | "My renders (N)" ni bosing | Darhol eng yangi render ko'rinadi (bo'sh "The result will appear here" emas) | #164 (R4) | |
| 1.7 | 360° kamera | 360 ni tanlang | Kamera xona o'rtasida, **xonaning ochiq tomoniga** (uzun o'q bo'ylab) qarab ochiladi, devorga emas | #150, #164 (QA #2, R7) | |
| 1.8 | 360° kamera | Atrofga qarang, pastga qarang | Kenglikda bitta devor emas, xona ko'rinadi; pastda qora ko'pburchak (abajur ichi) **yo'q**, gilam va parket ko'rinadi | #150, #152 | |
| 1.9 ⭐ | 360° aylanish | Ekranning to'liq kengligi bo'ylab suring | Taxminan 180° buriladi (oldin ~90°) | #164 (QA #18) | |
| 1.10 | Flat | "Flat" ni bosing | 3 xona ko'rinadi, kvartira ekran markazida; xonalar ustma-ust tushsa — "Some rooms overlap…" ishorasi | #160, #164 (QA #9, R15) | |

## 2. Gestlar (⭐ — hammasi haqiqiy telefonda)

| # | Qadamlar | Kutilgan natija | PR | Natija |
|---|---|---|---|---|
| 2.1 ⭐ | Devor ustida ikki barmoq bilan kattalashtiring (pinch) | Devor menyusi **ochilmaydi** | #154 (QA #6) | |
| 2.2 ⭐ | Pinch-zoom (kichik harakat) | Zoom barmoqqa proporsional; tashqaridan bir pinch bilan polga "uchib kirmaydi" — xona chetida to'xtaydi, keyingi pinch ichkariga kiradi | #163 (R9) | |
| 2.3 ⭐ | Mebel ustida pinch qiling | Mebel **tanlanmaydi**, faqat zoom bo'ladi | #165 (R9) | |
| 2.4 ⭐ | Aylana menyu yoki toast yopilgandan keyin darhol sudrang | Birinchi sudrash ham ishlaydi (kamera aylanadi) | #163 (R8) | |
| 2.5 ⭐ | Mebelni bir bosib tanlang, keyin sudrang | Mebel barmoq ortidan yuradi; barmoq "bekor" bo'lsa (masalan tizim imo-ishorasi) mebel joyida qoladi, kamera qotib qolmaydi | #165 (QA #4) | |
| 2.6 | Devorni uzoqdan, eshik yonida bosing | Avval toifalar (Color, Wallpaper, Window, Door…) ochiladi, eshik modellari emas | #155 (QA #8) | |
| 2.7 ⭐ | Eshik yonidagi devorni bosib turing | Devor menyusi ochiladi, orqadagi eshikning "o'chirish" menyusi emas | #163 | |

## 3. Menyular va nomlar

| # | Qadamlar | Kutilgan natija | PR | Natija |
|---|---|---|---|---|
| 3.1 | Aylana menyuda chetdagi (xira) elementni bir marta bosing | Shu element **birinchi bosishda** tanlanadi | #155 (QA #7) | |
| 3.2 | Aylana menyu hisoblagichi | "1/21" emas, "1 of 21" / "1 из 21" / "21 tadan 1" | #163 (QA #19) | |
| 3.3 | Tepadagi "Mening xonam · …" yozuvini bosing | 7 bosqich ro'yxati ochiladi, tanlangani belgilangan; tanlasa bosqich almashadi | #163 (QA #17) | |
| 3.4 | ⋮ menyu | "Delete room" / "Удалить комнату" / "Xonani o'chirish" | #163 (QA #15) | |

## 4. Mebel va chiroq

| # | Qadamlar | Kutilgan natija | PR | Natija |
|---|---|---|---|---|
| 4.1 | ↖ → Furniture → Living room → **Televizor 2** | TV xona o'rtasiga emas, **uzun devorga** tushadi, old tomoni xonaga qaragan. (Agar u kameraga yaqin, kesib ko'rsatilgan devorga tushsa, tashqaridan orqasi ko'rinadi — bu ma'lum, qaror kutilmoqda.) Sinovdan keyin o'chiring | #153, #165, #166 (QA #5, R1) | |
| 4.2 | Biror shkaf/stellaj qo'shing | Bo'sh devorga, eshik oldiga emas, boshqa mebel ustiga emas | #153 (QA #5) | |
| 4.3 | Shiftdan baland model (masalan Televizor 2, 2,75 m, shift 2,4 m) | Model shiftdan chiqib turmaydi — proporsional kichrayadi | #151 (QA #3) | |
| 4.4 | Mebelni tanlang | Chap panelda "90°", "−", "+" tugmalari; 90° buradi (joy bo'lmasa toast bilan rad etadi), +/− o'lchamni 10% o'zgartiradi | #165 (QA #14) | |
| 4.5 ⭐ | Tanlangan mebelni bosib turing | O'chirish menyusidagi nom yorlig'i mebel kartochkasi ustiga tushmaydi | #165 (R14) | |
| 4.6 | ↖ → Light fixtures → Chandelier | Yangi qandil mavjud chiroqlar ustiga emas, kamida ~60 sm nariga tushadi. Sinovdan keyin o'chiring | #165 (R6) | |
| 4.7 | Osma chiroq / qandil (shift 2,4 m) | Chiroq shiftning tagida qisqa osilgan, xonaning yarmini egallamaydi | #157 | |

## 5. Xona ko'rinishi

| # | Qadamlar | Kutilgan natija | PR | Natija |
|---|---|---|---|---|
| 5.1 | AI designer → biror uslub, keyin tashqaridan (yuqoridan) qarang | Shift (karniz bilan) xonani yopmaydi; 1–4 / 360 kameralarda esa shift ko'rinadi | #158 (QA #10) | |
| 5.2 | Eshik yonidagi pastki qirra | Pol devordan "zinapoya" bo'lib chiqib turmaydi; devor kesilganda pol bo'lagi devor bilan birga so'nadi | #159, #167 (QA #11) | |
| 5.3 | Yashil devor burchagi | Ikki eshik romi — **xato emas**: xonada haqiqatan ikkita eshik bor (skaner ham ikkitasini qayd etgan) | — (R13) | |

## 6. Smeta (Estimate)

| # | Qadamlar | Kutilgan natija | PR | Natija |
|---|---|---|---|---|
| 6.1 | Ilova English → Estimate | Satrlar: "Plaster", "Primer", "Putty", "Paint"; birliklar "13 bags", "2 rolls", "7 pcs" | #156 (QA #13) | |
| 6.2 | Formulalar (kulrang qatorlar) | "→ 13 bags", "(walls 0, 1, 3) × 2 coats ÷ 9.0 m²/L" — o'zbekcha "qop / devor / qatlam / isrof / polosa" **yo'q** | #162 (R10) | |
| 6.3 | Ilova Русский → Estimate | Xuddi shu, ruscha va to'g'ri ko'plik shakli ("13 мешков") | #156, #162 | |
| 6.4 | Pol izohi | "The shop has no Chevron product yet… average … (approximate)" + "Choose a floor" havolasi; yuklanayotganda izoh almashib turmaydi | #156, #162 (QA #12, R11, R12) | |
| 6.5 | Kulrang izohlar (kunduzgi rejim) | Yaxshi o'qiladi (kontrast oshirilgan) | #162 (R11) | |
| 6.6 ⭐ | "Download PDF" — ilova English, keyin Русский | PDF ilova tilida; ruscha harflar to'g'ri (qora kvadratlar yo'q). iOS WebView'da PDF ochilishi/saqlanishini tekshiring | #169 | |

## 7. Ma'lum, hali ochiq masalalar (xato deb yozmang)
- TV kameraga yaqin (kesib ko'rsatilgan) devorga tushsa, tashqaridan orqasi xonani to'sadi — yo'nalish bo'yicha qaror kutilmoqda.
- Lotincha nomli Loftbek stollari (Horizon, Grid, Cluster…) ovqat stoli deb qaraladi — katalog ma'lumoti kerak.
- Do'konlardan olingan 307 ta mebel 3D modelsiz — studioga qo'yib bo'lmaydi.
- Tasdiqlanmagan: Qibla holati saqlanmasligi (QA #20), AI designer "Room type" tanlovi iOS'da ochilmasligi (QA #21) — iloji bo'lsa shularni ham qayta tekshiring.

## Natijani qaytarish
Shu faylni to'ldirib (yoki alohida `2026-11-06-…-natija.md`) PR qiling. ❌ bo'lgan har bir band uchun: qurilma, OS, ilova versiyasi, qadamlar, skrinshot/video.
