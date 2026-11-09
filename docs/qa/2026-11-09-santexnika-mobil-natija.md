# Hammom santexnikasi: mobil tekshiruv natijasi (2026-11-09)

Ro'yxat: [2026-11-08-santexnika-mobil-tekshiruv.md](2026-11-08-santexnika-mobil-tekshiruv.md).

**Muhit:**
- Qurilma: iOS Simulator, iPhone 17 Pro, iOS 26.
- Ilova: andoza_ai_mobile `main` (`877ece8`), versiya 1.0.0+30.
- Server: production `andozaai.uz`, #211–#216 deploy qilingandan keyin.
- Xona: "Hammom namunasi" (5,0 m², vanna, dush, unitaz, rakovina).
- Til: English. 4.7 va 4.8 Русский'da ham tekshirildi.

**Qamrov.** Faqat mobilga xos bandlar tekshirildi: teginish va surish, doira menyu, panelning telefon ekranida ko'rinishi, klaviatura, PDF yuklash. Joylash va smeta hisobi (1.x, 4.2–4.6) web'da qanday bo'lsa, ilovada ham shunday. Ular shu yerda faqat ko'z bilan ko'rildi.

> ⭐ bandlar haqiqiy telefonda tasdiqlanmagan. Simulyatorda barmoq harakati sun'iy yuboriladi.

> Tekshiruvdagi xona tekshiruvdan keyin avvalgi holatiga qaytarildi: qo'lda qo'shilgan nuqta o'chirildi, "Show pipe runs" o'chirildi.

## Qisqacha

| | Soni | Bandlar |
|---|---|---|
| ✅ | 10 | 2.5 ⭐, 3.2, 3.3, 3.4, 3.6, 4.1, 4.3, 4.5, 4.7, 4.8 ⭐ |
| ⚠️ qisman | 2 | 3.1, 3.5 |
| tekshirilmadi | qolganlari | web mantig'i, mobilga xos emas |

Web uchun 7 ta ish bor, ro'yxati pastda: [Web nima qilishi kerak](#web-nima-qilishi-kerak).

## Natijalar

| # | Natija |
|---|---|
| 2.5 ⭐ | ✅ simulyatorda: qo'lda qo'shilgan nuqta barmoq ostida C devori bo'ylab yuradi, kamera aylanmaydi ([rasm](img/2026-11-09-santexnika/08-manual-point-dragged.png)). Jihozning nuqtasi surilmaydi. Nuqta faqat yon tomonga emas, balandlikka ham yuradi: 90 sm → 115 sm |
| 3.1 | ⚠️ Ilovada bosqichlar qatori yo'q. Santexnika bosqichiga faqat burchak menyusi orqali kiriladi: ↖ → Plumbing → "+ Add a point". Shuning uchun bu bandni ilovada ro'yxatdagidek tekshirib bo'lmaydi |
| 3.2 | ✅ Jihozlar (Vanna 1, Rakovina 3, Unitaz, Dush 2) va nuqtalar ro'yxati chiqadi, har birida turi, devori va balandligi bor. Ammo panel telefonda tor, pastdagi 1-ishga qarang ([rasm](img/2026-11-09-santexnika/03-panel-narrow.png)) |
| 3.3 | ✅ Cold water · C · 90 → "Cold water · wall C · 90 cm · Remove". iOS'ning tanlash oynasi to'g'ri ochiladi. Kamchilik: klaviatura balandlik maydonini yopadi (4-ish) |
| 3.4 | ✅ "Drain: 4 points, ~11.6 m · Water: 7 points, ~23.9 m". Nuqta qo'shilganda 8 points, ~26.4 m bo'ldi ([rasm](img/2026-11-09-santexnika/04-panel-form-summary.png)) |
| 3.5 | ⚠️ Belgi yoqilganda chiziqlar chiziladi, lekin telefonda panel 3D'ning yarmini yopib turadi ([rasm](img/2026-11-09-santexnika/06-pipe-runs-half-hidden.png)). Panel yopilgandan keyin chiziqlar **qoladi**, ro'yxatda esa yo'qolishi kerak ([rasm](img/2026-11-09-santexnika/07-pipe-runs-stay-after-close.png)). Studio qayta ochilganda chiziqlar yo'q |
| 3.6 | ✅ Burchak menyusida "Plumbing" bor ([rasm](img/2026-11-09-santexnika/01-arc-plumbing-ring.png)). Uning halqasida 15 ta jihoz va oxirida "+ Add a point" ([rasm](img/2026-11-09-santexnika/02-arc-add-point.png)). "+ Add a point" panelni ochadi. Farq: ro'yxatda halqada "nuqtalar" bo'ladi deyilgan, aslida jihozlar chiqadi |
| 4.1 | ✅ "Plumbing / Сантехника" bo'limi bor: 14 948 500 so'm, jami 15 651 500 so'm |
| 4.3 | ✅ Fittings "11 points × 1 set", "Work: connecting a point" va har jihozni o'rnatish qatorlari bor |
| 4.5 | ✅ PDF'da quvur qatorlarida "has no such pipe, an average…" / «в магазине нет этой трубы…» izohi bor |
| 4.7 | ✅ Ruscha: «11 комплектов × 35 000 сум», «11 точек × 1 комплект», «Работа: установка ванны» |
| 4.8 ⭐ | ✅ simulyatorda: "Download PDF" / «Скачать PDF» iOS ulashish oynasini ochadi (94–100 KB). PDF'da "Plumbing (13 lines)" / «Сантехника (13 строк)» bo'limi bor. Kamchilik: jihozlar nomi o'zbekcha qolgan (5-ish). Eslatma: 1.0.0+29 da PDF yuklanmaydi, ilova blob'ni to'sadi. Bu +30 da tuzatilgan (andoza_ai_mobile PR #54), shuning uchun telefonda +30 bilan tekshirish kerak |

## Web nima qilishi kerak

1. **Santexnika paneli telefonda tor.** Panel ekranning faqat o'ng yarmini egallaydi. Natijada:
   - har nuqta 3 qatorga bo'linadi ("Cold water · / wall A · 20 / cm");
   - "Kind" tanlovida faqat "Dr" yoki "Cc" ko'rinadi.

   Telefon kengligida (< lg) panelni pastdan chiqadigan to'liq kenglikdagi oyna qiling yoki ekranni butunlay egallasin, boshqa bosqichlar paneli kabi. [rasm](img/2026-11-09-santexnika/04-panel-form-summary.png)
2. **"+ Add a point" bosilganda burchak menyusi yopilmaydi.** Panel ochilgandan keyin ham halqa va "11 of 15" 3D ustida qoladi. `closesMenu` kabi panelga o'tkazuvchi bandlar menyuni yopishi kerak. [rasm](img/2026-11-09-santexnika/03-panel-narrow.png)
3. **Quvur chiziqlari panel yopilgandan keyin qoladi.** Spec bo'yicha panel yopilganda ular yo'qolishi kerak (3.5). Telefonda panel ochiqligida chiziqlarning yarmi baribir ko'rinmaydi. Ikki yo'ldan birini tanlang:
   - panel yopilganda chiziqlarni o'chirish (spec bo'yicha);
   - belgi yoqilgan ekan, chiziqlarni panel yopilgandan keyin ham ko'rsatish (telefon uchun qulayroq), keyin spec va ro'yxatni yangilash.

   [rasm](img/2026-11-09-santexnika/07-pipe-runs-stay-after-close.png)
4. **iOS klaviaturasi "Height, cm" maydonini yopadi.** Maydon bosilganda klaviatura ochiladi, lekin panel aylanmaydi, maydon ko'rinmay qoladi. Focus bo'lganda maydonni ko'rinadigan joyga suring, masalan `scrollIntoView({ block: 'center' })` yoki `visualViewport` bo'yicha. [rasm](img/2026-11-09-santexnika/05-keyboard-hides-height.png)
5. **Jihozlar nomi en/ru'da o'zbekcha qoladi.** Quyidagi joylarda "Vanna 1", "Rakovina 3", "Dush 2", "Unitaz" deb yozilgan:
   - panel chiplari;
   - burchak menyusi halqasi;
   - inglizcha va ruscha PDF ("Plumbing: Rakovina 3", «Сантехника: Rakovina 3»).

   Katalogda `name_ru` / `name_en` bo'lsa o'shani, bo'lmasa vazifasi bo'yicha tarjima qilingan nomni ko'rsating (Bathtub / Ванна …).
6. **"+ Add a point" yorlig'ida ortiqcha "+" bor.** Halqadagi tugmada belgi `+` va matn "+ Add a point" ikkalasi ham bor. Matndan "+" ni olib tashlang. [rasm](img/2026-11-09-santexnika/02-arc-add-point.png)
7. **Ro'yxatni ilovaga moslash.** Bu kod emas, hujjat ishi:
   - 3.1 da ilovada bosqichlar qatori yo'qligini yozing, santexnikaga burchak menyusi orqali kiriladi;
   - 3.6 da halqada nuqtalar emas, jihozlar va "+ qo'shish" chiqishini yozing.

**Kichik kuzatuv (xato emas):** jihozning nuqtasini bosib turib sursa, devor menyusi ochiladi. Nuqta joyidan qimirlamaydi, bu to'g'ri.

## Mobil tomonda (andoza_ai_mobile)

- Bosh sahifadagi xona kartasida smeta **17.5M**, Studio smetasida **15.65M**. Kartadagi raqam ilovaning o'z smetasidan (E1) olinadi, u santexnika nuqtalarini bilmaydi. Bu mobil tomondagi ish.
- Simulyatorda Studio WebView ekranni bitta bosish kechikib chizadi, bir necha soniya kutish kerak. Bu simulyatorning xususiyati bo'lishi mumkin, telefonda ko'rinmasa e'tiborsiz qoldiriladi.
