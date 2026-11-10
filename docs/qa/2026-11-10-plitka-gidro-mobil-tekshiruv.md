# Plitka ishlari va gidroizolyatsiya: mobil ilovada tekshirish ro'yxati (2026-11-10)

**Kimga:** mobil tomon (andoza_ai_mobile), iOS va Android'da tekshirish uchun.
**Server:** production `andozaai.uz`, quyidagi PR'lar merge va deploy qilingandan keyin:
- #224: plitka ishlari smetada;
- #225: devor plitkasining balandligi;
- PR3: gidroizolyatsiya.

**Spec:** `docs/superpowers/specs/2026-11-10-plitka-gidroizolyatsiya-design.md`.
**Sinov xonasi:** "Hammom" (2.5 × 2.0 m, vanna, dush, unitaz, rakovina).

> ⭐ belgili bandlarni faqat **haqiqiy telefonda** tasdiqlash mumkin.

## Tekshirishdan oldin
1. Ilovani to'liq yoping va qayta oching, shunda WebView keshi yangilanadi.
2. Ilova tilini avval **English**, keyin **Русский** qiling.
3. Har bir bandning **Natija** ustuniga ✅ yoki ❌ va izoh yozing. ❌ bo'lsa, skrinshot va qadamlarni qo'shing.

---

## 1. Plitka ishlari smetada

| # | Qayerda | Qadamlar | Kutilgan natija | Natija |
|---|---|---|---|---|
| 1.1 | Studio | Devorni bosing → Tile → o'lcham va yuzani tanlang (bir devorga, keyin ikki marta bosib hamma devorga) | Devorlarda plitka ko'rinadi | |
| 1.2 | Smeta | Shu xonaning smetasini oching | "Wall finishes" bo'limida "Wall tile" qatori bor: m², formulada "× 1.10 (waste)". "AI price" belgili qator yo'q | |
| 1.3 | Smeta | Pastga suring | "Floor and skirting"dan keyin **Tile work / Плиточные работы** bo'limi bor | |
| 1.4 | Smeta | Bo'limni oching | "Tile adhesive" (qoplarda), "Grout" (donada), "Work: laying wall tile" (m²) qatorlari bor | |
| 1.5 | Smeta | Polga ham plitka qo'ying, smetani qayta oching | "Work: laying floor tile" qo'shiladi; yelim va zatirka miqdori oshadi | |
| 1.6 | Smeta | Plitkasiz xonaning (masalan, mehmonxona) smetasi | "Tile work" bo'limi yo'q | |
| 1.7 | Smeta | Ruscha | «Настенная плитка», «Плиточный клей», «Затирка», «Работа: укладка настенной плитки»; «мешков», «шт.» | |

## 2. Devor plitkasining balandligi

| # | Qayerda | Qadamlar | Kutilgan natija | Natija |
|---|---|---|---|---|
| 2.1 | Panel | Plitkali devorni tanlang → devor panelini oching | "Tile height" bo'limi: "To the ceiling", "1.5 m", "1.8 m", "2.1 m" va "Height, cm" maydoni | |
| 2.2 ⭐ | 3D | "1.5 m" ni bosing | Devorning pastki 1.5 m qismi plitka, tepasi bo'yoq. Eshik va deraza ikkala qismni ham kesadi. Chegarada tirqish yoki miltillash yo'q | |
| 2.3 | Panel | Balandlik shiftdan past | "Above the tile" ranglari chiqadi; rang bosilsa, tepa qism shu rangga bo'yaladi | |
| 2.4 | Panel | "To the ceiling" ni bosing | Plitka yana shiftgacha; "Above the tile" yo'qoladi | |
| 2.5 ⭐ | Panel | "Height, cm" maydoniga 120 yozing va klaviaturani yoping | Plitka 1.2 m gacha. Klaviatura maydonni yopmaydi. 20 yozilsa, 30 sm bo'ladi | |
| 2.6 | Undo | Balandlikni o'zgartiring → Undo | Oldingi balandlik qaytadi | |
| 2.7 | Smeta | 1.5 m balandlik bilan smetani oching | "Wall tile" maydoni kamaygan; bo'yoq qatori paydo bo'lgan yoki oshgan | |
| 2.8 | Saqlash | Saqlang, ilovani yopib qayta oching | Balandlik va tepa rang joyida | |
| 2.9 | Eski xona | Oldin plitka qo'yilgan eski xonani oching | Plitka avvalgidek shiftgacha | |

## 3. Gidroizolyatsiya

| # | Qayerda | Qadamlar | Kutilgan natija | Natija |
|---|---|---|---|---|
| 3.1 | Smeta | "Hammom" xonasining smetasi → "Tile work" bo'limi | "Waterproofing mastic" (kg), "Waterproofing tape" (m), "Work: waterproofing" (m²) qatorlari bor | |
| 3.2 | Smeta | Mastika qatorining formulasi | "Floor … m² + foot of the walls … m² + wet zone … m² = … m² × 1.5 kg/m² = … kg" | |
| 3.3 | Smeta | Vannani devordan uzoqlashtirib xona o'rtasiga qo'ying, smetani qayta oching | "wet zone" maydoni kamayadi | |
| 3.4 | Smeta | Mehmonxona yoki yotoqxona smetasi | Gidroizolyatsiya qatorlari yo'q | |
| 3.5 | Smeta | Plitka qo'yilmagan hammom | Gidroizolyatsiya qatorlari bor; yelim va zatirka yo'q | |
| 3.6 | Smeta | Ruscha | «Гидроизоляционная мастика», «Гидроизоляционная лента», «Работа: гидроизоляция»; formulada «Пол», «низ стен», «мокрая зона» | |
| 3.7 ⭐ | PDF | Smeta PDF'ini yuklab oling (en, keyin ru) | "Tile work" / «Плиточные работы» bo'limi va hamma qatorlar o'sha tilda | |
