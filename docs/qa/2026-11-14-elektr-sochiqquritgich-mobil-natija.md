# Elektr sochiqquritgich: mobil tekshiruv natijasi (2026-11-14)

Ro'yxat: [2026-11-14-elektr-sochiqquritgich-mobil-tekshiruv.md](2026-11-14-elektr-sochiqquritgich-mobil-tekshiruv.md) (issue #277).

**Muhit:**
- Qurilma: iOS Simulator, iPhone 17 Pro.
- Ilova: andoza_ai_mobile 1.0.2+35, debug build.
- Server: production `andozaai.uz`, master `fe21aaf8` (Deploy muvaffaqiyatli).
- Xona: "Hammom namunasi" → "Hammom".
- Til: Русский.

> ⭐ bandlar haqiqiy telefonda emas, simulyatorda ko'rildi. Barmoq harakati sun'iy yuboriladi.

> Tekshiruvdan keyin xona boshlang'ich holatiga qaytarildi: ikkala sochiqquritgich olib tashlandi, "Показать трассы труб" belgisi o'chirildi. Jami summa: oldin **21 987 530**, oxirida **21 987 530** so'm.

## Qisqacha

| | Soni | Bandlar |
|---|---|---|
| ✅ | 7 | 1, 2, 3, 4, 5, 8, 7 (kod bo'yicha) |
| ⚠️ | 1 | 6: ikkinchi sochiqquritgich birinchisining ustiga tushadi |
| tekshirilmadi | 1 | 9: admin hisobi bilan kirilmadi |

**Asosiysi:** "Водяной | Электрический" almashtirgichi ishlaydi:
- suv nuqtalari yo'qoladi;
- 3D'da ulash qutisi chiqadi;
- smetaga to'rtta yangi qator tushadi;
- Undo va Redo har bir almashtirishni bitta qadamda qaytaradi.

Topilgan bitta muammo bu o'zgarishdan oldin ham bo'lgan: ikkinchi sochiqquritgich qo'shilganda, u birinchisi turgan joyga qo'yiladi.

## Natijalar

| # | Natija |
|---|---|
| 1 ⭐ | ✅ Qo'shilganda qatorda "стена D • 100 см \| Водяной \| Электрический \| Убрать" bor, "Водяной" tanlangan. Ro'yxatda ikkita "Горячая вода • стена D • 100 см (сушителя)" nuqtasi chiqdi. 3D'da narvon va quvurlar bor ([rasm](img/2026-11-14-elektr-sochiqquritgich/01-water-3d.jpg)) |
| 2 ⭐ | ✅ "Электрический" bosilganda ikkala "(сушителя)" nuqtasi yo'qoldi. Quvur yig'indisi "Вода: 9 точ., ~20,4 м" dan "Вода: 7 точ., ~17,8 м" ga tushdi ([rasm](img/2026-11-14-elektr-sochiqquritgich/02-electric-panel.jpg)). 3D'da narvonning pastki chetida kichik oq quti paydo bo'ldi, qizil nuqtalar yo'q ([rasm](img/2026-11-14-elektr-sochiqquritgich/03-electric-box-3d.jpg)) |
| 3 ⭐ | ✅ Yana "Водяной" bosilganda ikkala nuqta qaytdi ([rasm](img/2026-11-14-elektr-sochiqquritgich/04-water-again-panel.jpg)). Undo bir marta bosilganda elektr holati qaytdi: quti bor, nuqta yo'q ([rasm](img/2026-11-14-elektr-sochiqquritgich/05-undo-electric.jpg)). Redo yana suvliga qaytardi: qizil nuqta bor, quti yo'q ([rasm](img/2026-11-14-elektr-sochiqquritgich/06-redo-water.jpg)). Eslatma: santexnika paneli ochiq turganda Undo bosilsa, panel yopiladi xolos. Undo panel yopiq holatda ishlaydi |
| 4 ⭐ | ✅ Elektr turida narvon 3D'da barmoq bilan surildi va "Сохранено" chiqdi. Quti narvon bilan birga yuradi. Siljish kichik bo'ldi, ro'yxatdagi yozuv "100 см" bo'lib qoldi |
| 5 | ✅ Elektr turida "Сантехника" bo'limining oxirida to'rtta qator chiqdi ([rasm](img/2026-11-14-elektr-sochiqquritgich/07-smeta-electric.jpg)): "Электрический полотенцесушитель" 900 000, "Влагозащищённая розетка (IP44)" 70 000, "Электрокабель (полотенцесушитель)" 3 м × 9 500 = 28 500, "Работа: установка электрического полотенцесушителя" 150 000. Jami summa boshlang'ichdan aynan 1 148 500 so'mga oshdi. Bu to'rtta qatorning yig'indisi, suvli sochiqquritgichning qatorlari qo'shilmagan. "Водорозетка" 7 ta, sochiqquritgich nuqtalari yo'q |
| 6 ⭐ | ⚠️ Smetaning o'zi to'g'ri: bitta suvli va bitta elektr bo'lganda "Полотенцесушитель" 650 000 qatori ham, elektrning to'rtta qatori ham chiqdi. **Lekin** "Добавить полотенцесушитель" bilan qo'shilgan ikkinchi narvon ham "стена D • 100 см" ga tushdi, ya'ni birinchisining aynan ustiga ([panel](img/2026-11-14-elektr-sochiqquritgich/08-two-rails-same-place.jpg), [3D: faqat bittasi ko'rinadi](img/2026-11-14-elektr-sochiqquritgich/09-two-rails-3d.jpg)). Sababi: `placeTowelRail` va `moveTowelRail` faqat kir yuvish mashinalaridan qochadi (`towelRailSlice.ts`, `machines()`), boshqa sochiqquritgichlarni hisobga olmaydi |
| 7 | ✅ Kod bo'yicha: `kind` saqlanmagan eski narvon suvli hisoblanadi (`towelRail.ts`: faqat `kind === 'electric'` elektr). Boshqa eski xona simulyatorda ochilmadi |
| 8 | ✅ Ruscha ilovada ko'rildi: "Водяной / Электрический" va smetaning to'rtta qatori. Inglizcha va o'zbekcha kalitlar fayllarda bor ("Water / Electric", "Electric towel rail", "Moisture-proof socket (IP44)"; "Suvli / Elektr"). Inglizcha ilovada ochib ko'rilmadi |
| 9 | tekshirilmadi: admin hisobi bilan kirilmadi |

## Qo'shimcha kuzatuvlar

- Rozetka (IP44) va elektr kabel smetada "Электрика и освещение" ichida emas, "Сантехника" ichida turibdi. Xato emas, lekin elektrik uchun izlash noqulay bo'lishi mumkin.
- Bu xonada D devordagi narvon ochiq eshik ortida qoladi ([rasm](img/2026-11-14-elektr-sochiqquritgich/03-electric-box-3d.jpg)). Joy tanlashda eshik ochiladigan maydon hisobga olinmaydi.
