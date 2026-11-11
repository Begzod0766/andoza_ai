# Quvur sxemasi: mobil ilovada tekshirish ro'yxati (2026-11-11)

**Kimga:** mobil tomon (andoza_ai_mobile), iOS va Android'da tekshirish uchun.
**Server:** production `andozaai.uz`, #241 (ichida smeta va studiya PR'lari) merge va deploy qilingandan keyin.
**Spec:** `docs/superpowers/specs/2026-11-11-quvur-sxemasi-design.md`.
**Sinov xonasi:** xona turi **Hammom**, taxminan 2,5 × 2,0 m, bitta eshik; vanna, unitaz, rakovina, dush va bitta sochiq quritgich. Ikkinchi xona sifatida bu yangilanishdan oldin saqlangan istalgan hammom.

> ⭐ belgili bandlarni faqat **haqiqiy telefonda** tasdiqlash mumkin. Ularni birinchi navbatda ko'ring: 3D chiziqlar faqat geometriya testlari bilan tekshirilgan, hech kim ularni ekranda ko'rmagan.

## Tekshirishdan oldin
1. Ilovani to'liq yoping va qayta oching, shunda WebView keshi yangilanadi.
2. Ilova tilini avval **English**, keyin **Русский** qiling.
3. Har bir bandning **Natija** ustuniga ✅ yoki ❌ va izoh yozing. ❌ bo'lsa, skrinshot va qadamlarni qo'shing.

---

## 1. Quvurlar 3D'da

Hammomni oching → ↖ burchak menyusi → Plumbing → **Show pipe runs** belgisini yoqing.

| # | Qayerda | Qadamlar | Kutilgan natija | Natija |
|---|---|---|---|---|
| 1.1 ⭐ | 3D | Chiziqlarga umuman qarang | Har bir rangda **bitta** magistral devor bo'ylab yuradi (kulrang kanalizatsiya, ko'k sovuq suv, qizil issiq suv). Har bir nuqtadan stoyakkacha alohida chiziqlar "yelpig'ichi" **yo'q** | |
| 1.2 ⭐ | 3D | Har bir nuqtaga qarang | Magistraldan nuqtagacha **tik** chiziq ko'tariladi (yoki tushadi). Nuqtalarning hammasi o'z magistraliga ulangan | |
| 1.3 ⭐ | 3D | Balandliklarga qarang | Suv magistrallari poldan ~20 sm balandda, qizili ko'kidan biroz (~5 sm) yuqorida, ustma-ust tushmaydi. Kanalizatsiya polda yotadi | |
| 1.4 ⭐ | 3D | Unitazdan stoyakkacha bo'lgan kulrang chiziq | Bu bo'lak qolgan kulrang chiziqdan **qalinroq** (Ø110). Unitazdan narigi bo'lak ingichka (Ø50) | |
| 1.5 ⭐ | 3D | Eshik atrofiga qarang | Hech bir magistral eshik ochig'i oldidan o'tmaydi: chiziqlar eshikning ikki tomonida tugaydi | |
| 1.6 ⭐ | 3D | Burchaklarga qarang | Chiziq burchakda burilib, keyingi devor bo'ylab davom etadi; devordan ~4 sm narida, devor ichiga kirmaydi | |
| 1.7 ⭐ | 3D | Rakovinani boshqa devorga suring | Chiziqlar darhol yangi joyga moslashadi: magistral uzayadi yoki qisqaradi, tik chiziq rakovina bilan birga yuradi | |
| 1.8 ⭐ | 3D | Qo'lda qo'shilgan nuqtani barmoq bilan suring | Uning tik chizig'i va magistral u bilan birga yangilanadi | |
| 1.9 | 3D | Belgini o'chiring | Hamma quvur chiziqlari yo'qoladi, nuqtalar qoladi | |
| 1.10 ⭐ | 3D | Xona eshiksiz bo'lsa (eshikni o'chirib ko'ring) | Magistral baribir hamma nuqtaga yetadi, eng katta bo'sh oraliqda uzilgan | |

## 2. Panel xulosasi

| # | Qayerda | Qadamlar | Kutilgan natija | Natija |
|---|---|---|---|---|
| 2.1 | Panel | Santexnika panelining pastidagi xulosa ("Drains: N points, ~X m · Water: M points, ~Y m") | Nuqtalar soni avvalgidek; metrlar **avvalgidan kamroq** | |
| 2.2 | Panel → Smeta | Xulosadagi suv metrini smetadagi "PPR water pipe Ø20" miqdori bilan solishtiring | Bir xil (xulosada bitta kasr xonagacha yaxlitlangan) | |
| 2.3 | Panel → Smeta | Kanalizatsiya metrini smetadagi "Drain pipe Ø50" + "Drain pipe Ø110" yig'indisi bilan solishtiring | Bir xil (±0,1 m yaxlitlash) | |

## 3. Smeta

| # | Qayerda | Qadamlar | Kutilgan natija | Natija |
|---|---|---|---|---|
| 3.1 | Smeta | Hammom smetasi → "Plumbing" bo'limi → "PPR water pipe Ø20" | Formula: "Trunk 13.20 m + branches 5.00 m = 18.20 m × 1.15 = 20.93 m" ko'rinishida (sonlar xonaga qarab) | |
| 3.2 | Smeta | "Drain pipe Ø50" va "Drain pipe Ø110" | Ikkalasida ham "Trunk … + branches …" formulasi | |
| 3.3 | Smeta | Fiting qatorlari | **"Fittings" qatori yo'q.** O'rniga (soni 0 bo'lmaganlari): "PPR tee Ø20", "PPR elbow Ø20", "Wall outlet Ø20", "Ball valve Ø20", "Drain tee Ø50", "Drain elbow Ø50", "Drain tee Ø110/50", "Drain elbow Ø110" | |
| 3.4 | Smeta | Har bir fiting qatorining formulasi | Sanash qayerdan kelgani yozilgan: "5 branches + 1 riser = 6 pcs", "4 corners + 2 ends = 6 pcs", "9 points", "2 lines", "2 joins", "1 toilet + 1 corner = 2 pcs" | |
| 3.5 | Smeta | Fiting qatorlarining belgisi | Har birida "~taxminiy" belgisi va "fitinglar uchun o'rtacha narx" ogohlantirishi | |
| 3.6 | Smeta | "Ball valve Ø20" miqdori | Sovuq va issiq suv bo'lsa 2 pcs, faqat sovuq bo'lsa 1 pcs | |
| 3.7 | Smeta | Unitazni olib tashlang, saqlang | "Drain pipe Ø110", "Drain tee Ø110/50", "Drain elbow Ø110" qatorlari yo'qoladi | |
| 3.8 | Smeta | Faqat sochiq quritgich qolgan xona (boshqa santexnika yo'q) | Issiq suv quvuri, "Ball valve Ø20" 1 pcs, "Wall outlet Ø20" 2 pcs; kanalizatsiya qatorlari yo'q | |
| 3.9 | Smeta | "Santexnika" bo'limi jami | Avvalgidan kamroq (kamroq quvur, sanalgan fitinglar) | |
| 3.10 | Smeta | Ruscha | "Тройник PPR Ø20", "Угол PPR Ø20", "Водорозетка Ø20", "Шаровой кран Ø20", "Канализационный тройник Ø50", "Канализационный отвод Ø110"; formulalar: "Магистраль … м + отводы … м", "5 отводов + 1 стояк = 6 шт." | |
| 3.11 ⭐ | PDF | Smeta PDF'ini yuklab oling (en, keyin ru) | Yangi qatorlar va formulalar PDF'da ham, o'sha tilda; "Fittings" qatori yo'q | |

## 4. Eski xonalar

| # | Qayerda | Qadamlar | Kutilgan natija | Natija |
|---|---|---|---|---|
| 4.1 | Eski hammom | Bu yangilanishdan oldin saqlangan hammomni oching | Xona xatosiz ochiladi, nuqtalar joyida | |
| 4.2 | Eski hammom | Uning smetasini oching | Xatosiz; quvur qatorlari yangi formulada, fitinglar 8 ta qator ko'rinishida; jami kamaygan | |
| 4.3 | Santexnikasiz xona | Mehmonxona smetasini oching | "Plumbing" bo'limi yo'q, hech narsa o'zgarmagan | |
| 4.4 | Xona shakli | Hammomda devor uzunligini o'zgartiring | Quvur chiziqlari va xulosa yangilanadi, xato chiqmaydi, manfiy metr yo'q | |
