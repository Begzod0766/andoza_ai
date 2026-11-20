# Stoyakni surish: mobil tekshiruv natijasi (2026-11-13)

Ro'yxat: [2026-11-13-stoyak-surish-mobil-tekshiruv.md](2026-11-13-stoyak-surish-mobil-tekshiruv.md). Issue: #254. PR: #253.

**Muhit:**
- Qurilma: iOS Simulator, iPhone 17 Pro.
- Ilova: andoza_ai_mobile `main` (`54998f0`), versiya 1.0.0+33. Ilova to'liq yopilib, qayta ochildi.
- Server: production `andozaai.uz`, master `e75f1415` (#253). Sahifa `Cache-Control: no-cache` bilan keladi (#252).
- Xona: "Hammom namunasi" → "Hammom". Til: avval English, keyin Русский.

> ⭐ bandlar haqiqiy telefonda emas, simulyatorda ko'rildi. Simulyatorda barmoq harakati sun'iy yuboriladi.

> **Tekshiruvdan keyin xona asl holida:** "Automatic (door corner)" bosildi. Stoyak D devorda, 0 sm, tugma o'chiq. Xulosa avvalgidek: "Drain: 4 points, ~8.0 m · Water: 7 points, ~17.8 m". Xonaga hech narsa qo'shilmadi. "Show pipe runs" o'chirildi, til O'zbekchaga qaytarildi.

## Qisqacha

| | Soni | Bandlar |
|---|---|---|
| ✅ | 15 | 1.1 ⭐, 1.3 ⭐, 1.4 ⭐, 1.5 ⭐, 1.6 ⭐, 1.7, 2.1–2.7, 3.1, 3.2 |
| ⚠️ qisman | 1 | 1.2 ⭐ |
| tekshirilmadi | 5 | 3.3, 3.4, 3.5, 4.1, 4.2 |

**Asosiy topilmalar:**
1. **1.2:** Plumbing bosqichidan boshqa bosqichga (Color) o'tilganda stoyak **yashirinmaydi**. Ilova qayta ochilib, Studio Plumbing bo'lmagan bosqichda ochilganda esa stoyak ko'rinmaydi.
2. **Qulf yoqiq bo'lsa stoyakni surib bo'lmaydi.** Pastdagi qulf tugmasi ko'k (yoqiq) holatda stoyakni surganda kamera aylanadi. Qulf o'chirilgandan keyin surish ishlaydi. Studio bu sessiyada qulf yoqiq holda ochildi. Bu kutilgan xatti-harakatmi? Agar shunday bo'lsa, panel izohida aytib o'tish kerak ("qulfni oching").
3. **"Saved" yozuvi Undo/Redo tugmalarini siljitadi** (kichik UX). "✓ Saved" chiqqanda tugmalar chapga suriladi, yo'qolganda o'ngga qaytadi. Shu sabab birinchi Undo bosilishi bo'sh joyga tushdi.

## 1. Stoyak 3D'da

| # | Natija |
|---|---|
| 1.1 ⭐ | ✅ Stoyak poldan shipgacha kulrang-ko'k tik quvur, devorga yopishgan, devor ichiga kirmaydi ([rasm](img/2026-11-13-stoyak/02-stoyak-3d.jpg)). Plumbing bosqichida "Show pipe runs" o'chiq bo'lsa ham ko'rinadi. Izoh: eshik burchagi (D, 0 sm) bu xonada kameraga yaqin, yashiriladigan old devorda. Simulyatorda kamera u tomonga aylana olmadi, shuning uchun stoyak B va C devorlarda ko'rildi |
| 1.2 ⭐ | ⚠️ Ilova qayta ochilib, xona Plumbing bo'lmagan bosqichda ochilganda stoyak ko'rinmaydi ✅. Lekin Plumbing'dan **Color** bosqichiga o'tilganda ("Show pipe runs" o'chiq) stoyak joyida qoladi ([rasm](img/2026-11-13-stoyak/09-color-bosqichida-stoyak.jpg), aylanada "1 of 113" Color tanlangan) ❌ |
| 1.3 ⭐ | ✅ Qulf o'chiq bo'lsa, stoyak devor bo'ylab yuradi, kamera aylanmaydi, "Saved" chiqadi ([rasm](img/2026-11-13-stoyak/04-surish-B.jpg)). ⚠️ Qulf yoqiq bo'lsa surish o'rniga kamera aylanadi ([rasm](img/2026-11-13-stoyak/03-qulf-yoqiq-kamera-aylanadi.jpg)) |
| 1.4 ⭐ | ✅ B devor oxiridan surilganda C devorga o'tadi va C bo'ylab davom etadi ([rasm](img/2026-11-13-stoyak/05-burchakdan-otish.jpg)) |
| 1.5 ⭐ | ✅ "Show pipe runs" yoqiq: suv va kanalizatsiya quvurlari stoyakning yangi joyidan boshlanadi, burchakni aylanib boradi. Simulyatorda faqat surish oxiridagi holat ko'rildi, surish paytida qayta chizilishini kuzatib bo'lmadi |
| 1.6 ⭐ | ✅ C bo'ylab uzoq surildi → Undo bir marta → stoyak surish boshlangan joyga qaytdi, Redo yoqildi ([rasm](img/2026-11-13-stoyak/07-undo.jpg)). Birinchi bosish bo'sh joyga tushdi: "Saved" yozuvi tugmalarni siljitdi ([kesilgan rasm](img/2026-11-13-stoyak/06-saved-tugmani-siljitadi.jpg)) |
| 1.7 | ✅ Stoyakni surmasdan bosganda devor menyusi ochilmaydi |

## 2. Panelda

| # | Natija |
|---|---|
| 2.1 | ✅ **Riser** bo'limi: "Riser wall" = D, "From the wall's start, cm" = 0, "Automatic (door corner)" o'chiq, izoh "You can also drag the riser along the walls in 3D." ([rasm](img/2026-11-13-stoyak/01-panel-riser.jpg)) |
| 2.2 | ✅ Devor D → B: stoyak B ga o'tdi, "Automatic" yoqildi, "Saved" chiqdi |
| 2.3 | ✅ C devor, `120` + Enter: stoyak C o'rtasiga o'tdi, xulosa 7.2/14.8 m. (Kuzatuv: B devorda 0 va 120 da xulosa ikkalasida ham 5.4/11.2 m bo'ldi, stoyak esa 3D'da surildi. Ehtimol, quvurlar bu oraliqda bir xil uzunlikda chiqadi) |
| 2.4 | ✅ `999` → maydon o'zi 250 ga (C devor uzunligi) tushdi, stoyak devor oxirida, xato yo'q ([rasm](img/2026-11-13-stoyak/08-999.jpg)) |
| 2.5 | ✅ Xulosa stoyak bilan birga o'zgaradi: D0 8.0/17.8 → B0 5.4/11.2 → C101 (surilgan) 7.0/14.4 → C120 7.2/14.8 → C250 8.0/17.8 m |
| 2.6 | ✅ "Automatic" → D, 0 sm, tugma yana o'chdi, xulosa 8.0/17.8 m ([rasm](img/2026-11-13-stoyak/12-automatic.jpg)) |
| 2.7 | ✅ «Стояк», «Стена стояка», «От начала стены, см», «Автоматически (угол у двери)» ([rasm](img/2026-11-13-stoyak/13-ruscha.jpg)). Kichik izoh: «Стояк можно двигать вдоль стен и в 3D» ma'noni biroz o'zgartiradi. Inglizchasi "drag along the walls in 3D", ruschasi taxminan «Стояк можно перетаскивать вдоль стен в 3D» bo'lishi kerak |

## 3. Saqlash va smeta

| # | Natija |
|---|---|
| 3.1 | ✅ Stoyak C, 120 sm → ilova to'liq yopilib qayta ochildi → panelda C, 120, xulosa 7.2/14.8 m ([rasm](img/2026-11-13-stoyak/10-saqlangan.jpg)) |
| 3.2 | ✅ Smeta → Plumbing: Ø50 0.65 m + Ø110 5.58 m = 6.23 m × 1.15 ≈ 7.2 m, PPR Ø20 12.87 × 1.15 = 14.80 m. Bular paneldagi 7.2/14.8 m ga teng ([rasm](img/2026-11-13-stoyak/11-smeta-quvurlar.jpg)) |
| 3.3 | tekshirilmadi (PDF) |
| 3.4, 3.5 | tekshirilmadi: namunaviy xonaga yangi unitaz va sochiq quritgich qo'shish kerak edi |

## 4. Eski xonalar

| # | Natija |
|---|---|
| 4.1, 4.2 | tekshirilmadi: boshqa eski hammom tanlanmadi, eshikni ko'chirish xonani o'zgartiradi |

## Web uchun

1. **1.2:** Plumbing'dan boshqa bosqichga o'tganda stoyakni yashirish (hozir faqat Studio qayta ochilganda yashirinadi).
2. **Qulf:** qulf yoqiqligida stoyak surilmasligi kutilganmi? Agar shunday bo'lsa, panel izohiga qo'shish yoki qulfni stoyakka ta'sir qilmaydigan qilish.
3. Kichik: "Saved" yozuvi Undo/Redo tugmalarini siljitmasin (joy oldindan ajratilsin yoki yozuv boshqa joyda chiqsin).
4. Kichik: ruscha izoh matni (2.7).
