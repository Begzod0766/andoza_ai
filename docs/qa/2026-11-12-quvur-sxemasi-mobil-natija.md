# Quvur sxemasi: mobil tekshiruv natijasi (2026-11-12)

Ro'yxat: [2026-11-11-quvur-sxemasi-mobil-tekshiruv.md](2026-11-11-quvur-sxemasi-mobil-tekshiruv.md). Issue: #244.

**Muhit:**
- Qurilma: iOS Simulator, iPhone 17 Pro, iOS 26.
- Ilova: andoza_ai_mobile `main` (`0caa4f7`), versiya 1.0.0+32.
- Server: production `andozaai.uz`, master `5713db8` (#241 va #245 deploy qilingandan keyin).
- Xonalar: "Hammom namunasi" → "Hammom" (2.5 × 2.0 m: vanna, rakovina, unitaz, dush; quritgich yo'q) va "Mening xonam" (santexnikasiz).
- Til: avval English, keyin Русский.

> ⭐ bandlar haqiqiy telefonda tasdiqlanmagan. Simulyatorda barmoq harakati sun'iy yuboriladi va WebView rasmni bitta harakat kechikib chizadi. Shu sababli jihozni surish testlari production xonasida xavfli bo'ldi: surish o'rniga boshqa jihoz tanlanib qoldi.

> Tekshiruv uchun "Hammom"ga B devoriga 50 sm balandlikda bitta "Drain" nuqtasi qo'lda qo'shildi va keyin o'chirildi. Xona avvalgi holida: panel xulosasi "Drain: 4 points, ~7.8 m · Water: 7 points, ~18.4 m", smeta 19 096 880 so'm. Ilova tili Русский'da qoldi.

## Qisqacha

| | Soni | Bandlar |
|---|---|---|
| ✅ | 17 | 1.6 ⭐, 1.9, 2.1–2.3, 3.1–3.6, 3.9, 3.10, 3.11 ⭐ (en, ru), 4.1–4.3 |
| ⚠️ qisman | 4 | 1.1 ⭐, 1.2 ⭐, 1.3 ⭐ (suv qismi ✅, kanalizatsiya deyarli ko'rinmaydi), 1.8 ⭐ |
| ❓ aniqlab bo'lmadi | 1 | 1.4 ⭐: kanalizatsiya chizig'i deyarli ko'rinmaydi |
| tekshirilmadi | 6 | 1.5 ⭐, 1.7 ⭐, 1.10 ⭐, 3.7, 3.8, 4.4 |

**Asosiy topilma: kulrang kanalizatsiya chizig'i polda deyarli ko'rinmaydi.** U chiziladi: qo'lda qo'shilgan nuqtadan kulrang tik tarmoq tushadi va pol bo'ylab och kulrang chiziq ketadi. Lekin bu chiziq och kulrang pol rangiga deyarli qo'shilib ketgan. Ko'k va qizil chiziqlar esa aniq ko'rinadi. Shu sababli 1.4 (Ø110 qalinroq) ni ko'zda tekshirib bo'lmadi.

Web uchun 3 ta ish bor: [Web nima qilishi kerak](#web-nima-qilishi-kerak).

## Natijalar

### 1. Quvurlar 3D'da

| # | Natija |
|---|---|
| 1.1 ⭐ | ⚠️ Ko'k va qizil: har birida bitta magistral devor bo'ylab yuradi, nuqtalardan stoyakkacha "yelpig'ich" yo'q ✅ ([umumiy](img/2026-11-12-quvur-sxemasi/02-umumiy-korinish.jpg), [yaqindan](img/2026-11-12-quvur-sxemasi/03-burchak-yaqin.jpg)). Kulrang (kanalizatsiya) magistrali ekranda deyarli ko'rinmaydi, 1-ishga qarang |
| 1.2 ⭐ | ✅ suv: ko'k va qizil magistraldan nuqtagacha tik chiziq ko'tariladi, chiziqlar diskka yetib boradi (dush nuqtalari B devorida, 105 sm). Vanna nuqtalarining tarmoqlari vannaning ortida qoladi. ⚠️ kanalizatsiya: qo'lda qo'shilgan nuqtada (B, 50 sm) kulrang tik chiziq bor, lekin marmar devorda juda xira ([kesilgan rasm](img/2026-11-12-quvur-sxemasi/05-kanalizatsiya-xira-yaqin.jpg)) |
| 1.3 ⭐ | ✅ suv: qizil ko'kdan biroz yuqorida, ustma-ust tushmaydi, ikkalasi plintusdan biroz baland yuradi. ⚠️ kanalizatsiya polda yotadi, lekin pol bilan bir rangda. Dush drenaji (B, 0 sm) diskini ham plintus yonidan topib bo'lmadi |
| 1.4 ⭐ | ❓ Unitaz → stoyak bo'lagining qalinroq chizilganini ko'rib bo'lmadi: kanalizatsiya magistralining o'zi deyarli ko'rinmaydi. Kodda Ø110 uchun `lineWidth` 4, Ø50 uchun 2 |
| 1.5 ⭐ | tekshirilmadi: standart kamerada eshik devori ko'rinmaydi (kamera shu devor orqali qaraydi va unda chiziq chizilmaydi). Kamerani aylantirish simulyatorda jihozlarni tanlab yubordi, eshik oldini ishonchli ko'rsatib bo'lmadi |
| 1.6 ⭐ | ✅ Ko'k va qizil burchakda to'g'ri burilib, keyingi devorda davom etadi. Devordan biroz narida, devor ichiga kirmaydi ([rasm](img/2026-11-12-quvur-sxemasi/03-burchak-yaqin.jpg)) |
| 1.7 ⭐ | tekshirilmadi: production xonasida rakovinani surish simulyatorda xavfli (yuqoridagi izohga qarang) |
| 1.8 ⭐ | ⚠️ Panel orqali qo'shilgan nuqta (Drain, B, 50 sm) darhol chiziladi: kulrang disk, tik tarmoq va magistral ([rasm](img/2026-11-12-quvur-sxemasi/06-qolda-qoshilgan-drain.jpg)). Xulosa ham yangilandi: "Drain: 5 points, ~8.4 m". Nuqtani barmoq bilan surish tekshirilmadi: surishga urinishda kamera aylanib, "Ванна 1" tanlandi (vanna joyidan siljimadi) |
| 1.9 | ✅ Belgi o'chirilganda quvur chiziqlari yo'qoladi, nuqtalar qoladi |
| 1.10 ⭐ | tekshirilmadi: eshikni o'chirish production xonasini o'zgartiradi |

**Qo'shimcha kuzatuv (savol).** Studio yopilib, qayta ochilganda "Show pipe runs" belgisi har safar o'chiq holga qaytadi. Shunday bo'lishi kerakmi yoki belgi eslab qolinishi kerakmi? 2-ishga qarang.

### 2. Panel xulosasi

| # | Natija |
|---|---|
| 2.1 | ✅ Nuqtalar soni avvalgidek (4 va 7). Metrlar kamaydi: kanalizatsiya ~11.6 m → **~7.8 m**, suv ~23.9 m → **~18.4 m** (eski qiymatlar 2026-11-11 dagi tekshiruvdan) ([rasm](img/2026-11-12-quvur-sxemasi/01-panel-xulosa.jpg)) |
| 2.2 | ✅ Xulosada suv ~18.4 m; smetada "PPR water pipe Ø20" 18.37 m |
| 2.3 | ✅ Xulosada kanalizatsiya ~7.8 m; smetada Ø50 4.93 m + Ø110 2.9 m = 7.83 m |

### 3. Smeta

| # | Natija |
|---|---|
| 3.1 | ✅ "Trunk 12.57 m + branches 3.40 m = 15.97 m × 1.15 = 18.37 m" ([rasm](img/2026-11-12-quvur-sxemasi/08-smeta-quvurlar-en.jpg)) |
| 3.2 | ✅ Ø50: "Trunk 3.64 m + branches 0.65 m = 4.29 m × 1.15 = 4.93 m"; Ø110: "Trunk 2.32 m + branches 0.20 m = 2.52 m × 1.15 = 2.9 m". Tarmoqlar to'g'ri: Ø50 = 15 + 50 + 0 sm, Ø110 = unitazning 20 sm |
| 3.3 | ✅ "Fittings" qatori yo'q. 8 ta qator bor: PPR tee Ø20 — 5, PPR elbow Ø20 — 8, Wall outlet Ø20 — 7, Ball valve Ø20 — 2, Drain tee Ø50 — 1, Drain elbow Ø50 — 2, Drain tee Ø110/50 — 2, Drain elbow Ø110 — 2 ([1](img/2026-11-12-quvur-sxemasi/09-smeta-fitinglar-1-en.jpg), [2](img/2026-11-12-quvur-sxemasi/10-smeta-fitinglar-2-en.jpg), [3](img/2026-11-12-quvur-sxemasi/11-smeta-fitinglar-3-en.jpg)) |
| 3.4 | ✅ "3 branches + 2 risers = 5 pcs", "4 room corners + 4 trunk ends = 8 pcs", "7 points", "2 lines", "1 branch", "1 room corner + 1 trunk end = 2 pcs", "2 joins", "1 toilet + 1 room corner = 2 pcs" |
| 3.5 | ✅ Har bir fiting qatorida "approximate" belgisi va "Approximate price — an average price is used for the fittings." |
| 3.6 | ✅ Sovuq va issiq suv bor: "Ball valve Ø20" 2 pcs |
| 3.7 | tekshirilmadi: unitazni olib tashlash production xonasini o'zgartiradi |
| 3.8 | tekshirilmadi: faqat quritgichli xona yo'q, yangi xona yaratish kerak edi |
| 3.9 | ✅ "Plumbing" bo'limi 14 948 500 → **14 735 870** so'm; xona jami 19 309 510 → 19 096 880 so'm ([rasm](img/2026-11-12-quvur-sxemasi/07-smeta-jami-en.jpg)) |
| 3.10 | ✅ "Тройник PPR Ø20" ("3 отвода + 2 стояка = 5 шт."), "Угол PPR Ø20", "Водорозетка Ø20", "Шаровой кран Ø20", "Канализационный тройник Ø50" ("1 отвод"), "Канализационный тройник Ø110/50" ("2 врезки"), "Канализационный отвод Ø110" ("1 унитаз + 1 угол комнаты = 2 шт."). Quvurlarda "Магистраль … м + отводы … м" ([1](img/2026-11-12-quvur-sxemasi/12-smeta-ru-1.jpg), [2](img/2026-11-12-quvur-sxemasi/13-smeta-ru-2.jpg), [3](img/2026-11-12-quvur-sxemasi/14-smeta-ru-3.jpg)) |
| 3.11 ⭐ | ✅ simulyatorda: PDF en (103 KB) va ru (109 KB) yuklab olindi, share sheet ochildi. Ikkalasida 8 ta fiting qatori va "Trunk/Магистраль … + branches/отводы …" formulalari bor, "Fittings"/"Фитинги" qatori yo'q. (en PDF'dagi "Work: fitting the extractor fan" qatori ventilyator ishi, quvurga aloqasi yo'q.) |

Kichik kuzatuv: Ø110 miqdori "2.9 m" bo'lib chiqadi, boshqa qatorlarda esa ikki kasr xona ("4.93 m", "18.37 m"). Smetada ham, PDF'da ham, en va ru'da ham shunday. 3-ishga qarang.

### 4. Eski xonalar

| # | Natija |
|---|---|
| 4.1 | ✅ "Hammom" bu yangilanishdan oldin saqlangan. Xatosiz ochildi, nuqtalar joyida |
| 4.2 | ✅ Smetasi xatosiz: quvurlar yangi formulada, fitinglar 8 ta qatorda, jami kamaygan (3.9) |
| 4.3 | ✅ "Mening xonam" smetasida faqat "Электрика и освещение", "Сантехника" bo'limi yo'q ([rasm](img/2026-11-12-quvur-sxemasi/15-santexnikasiz-xona-ru.jpg)) |
| 4.4 | tekshirilmadi: devor uzunligini o'zgartirish production xonasini o'zgartiradi |

## Web nima qilishi kerak

1. **Kanalizatsiya chizig'ini ko'rinadigan qilish.** Ko'k va qizil yaxshi ko'rinadi, kulrang esa yo'q. Kulrang magistral pol sathida chiziladi (`pipeScheme.ts`: drain line `heightMm: 0`). Uning rangi `#9CA3AF` (`PlumbingPoints3D.tsx: COLOUR.drain`), och kulrang pol va marmar devorda deyarli ajralmaydi ([kesilgan rasm](img/2026-11-12-quvur-sxemasi/05-kanalizatsiya-xira-yaqin.jpg)). Taklif:
   - quyuqroq rang, masalan slate-600 `#475569`;
   - magistralni poldan bir necha mm ko'tarish yoki plintus oldiga chiqarish, shunda pol bilan ustma-ust tushmaydi.

   Shundan keyin 1.1, 1.3 va 1.4 (Ø110 qalinroq) ni telefonda qayta tekshirish mumkin.
2. **(savol)** "Show pipe runs" Studio har ochilganda o'chiq holga qaytadi. Shunday bo'lishi kerak bo'lsa, ish yo'q. Aks holda belgini xona yoki sessiya uchun eslab qolish kerak.
3. **(kichik)** Miqdor yaxlitlanganda oxiridagi nolni qoldirish: "2.9 m" o'rniga "2.90 m", boshqa qatorlar bilan bir xil bo'lsin. Smeta qatori, formula va PDF, en/ru.

Haqiqiy telefonda ko'rish qolgan bandlar: 1.4, 1.5, 1.7, 1.8 (surish), 1.10. Simulyatorda ularni production xonasini buzmasdan tekshirib bo'lmadi.
