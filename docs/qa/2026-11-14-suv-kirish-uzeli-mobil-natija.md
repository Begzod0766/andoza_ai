# Suv kirish uzeli: mobil tekshiruv natijasi (2026-11-14)

Ro'yxat: [2026-11-14-suv-kirish-uzeli-mobil-tekshiruv.md](2026-11-14-suv-kirish-uzeli-mobil-tekshiruv.md) (issue #266).

**Muhit:**
- Qurilma: iOS Simulator, iPhone 17 Pro.
- Ilova: andoza_ai_mobile 1.0.2+35, debug build.
- Server: production `andozaai.uz`, master `fe21aaf8`.
- Xona: "Hammom namunasi" → "Hammom". Unda rakovina, vanna, dush va unitaz bor.
- Til: Русский.

> ⭐ bandlar haqiqiy telefonda emas, simulyatorda ko'rildi. Barmoq harakati sun'iy yuboriladi.

> Tekshiruvdan keyin xona boshlang'ich holatiga qaytarildi: uzel va boyler belgilari o'chiq. Jami summa: oldin **21 987 530**, oxirida **21 987 530** so'm.

## Qisqacha

| | Soni | Bandlar |
|---|---|---|
| ✅ | 6 | 1, 2, 3, 4, 5, 6 |
| ⚠️ | 0 | (bir marta kuzatilgan holat: pastda, "Qo'shimcha kuzatuv"da) |
| tekshirilmadi | 1 | 7: admin hisobi bilan kirilmadi |

**Asosiysi:** belgi va smeta qatorlari ro'yxatda yozilganidek ishlaydi. 2 liniyada jami 1 460 000 so'm qo'shiladi, boyler yoqilganda 730 000 so'm.

## Natijalar

| # | Natija |
|---|---|
| 1 ⭐ | ✅ Santexnika panelida "Узел ввода воды (счётчик, фильтр, редуктор)" belgisi bor, boshida o'chiq ([rasm](img/2026-11-14-suv-kirish-uzeli/01-panel-off.jpg)) |
| 2 | ✅ Belgi o'chiq bo'lganda smetada hisoblagich, filtr, reduktor va teskari klapan qatorlari yo'q. Jami summa 21 987 530 ([rasm](img/2026-11-14-suv-kirish-uzeli/07-smeta-off-total.jpg)) |
| 3 | ✅ Boyler o'chiq turganda belgi yoqildi ([rasm](img/2026-11-14-suv-kirish-uzeli/02-panel-on.jpg)). "Сантехника" bo'limining oxirida 5 ta qator chiqdi, har birida "2 линии = 2 шт. × …" ([rasm](img/2026-11-14-suv-kirish-uzeli/03-smeta-2-lines-a.jpg)): Счётчик воды 2 × 180 000, Фильтр грубой очистки 2 × 60 000, Редуктор давления 2 × 250 000, Обратный клапан 2 × 40 000, Работа: сборка узла ввода воды 2 × 200 000. Jami summa aynan 1 460 000 so'mga oshdi (23 447 530) |
| 4 | ✅ Boyler ham yoqilganda 5 ta qator "1 линия = 1 шт. × …" bo'ldi, jami summa 24 935 030 ([rasm](img/2026-11-14-suv-kirish-uzeli/05-smeta-boiler-1-line.jpg)) |
| 5 | ✅ Ruscha ilovada 5 ta qator ham ro'yxatdagi nomlar bilan chiqdi. Inglizcha va o'zbekcha nomlar `smeta_locale.json` da bor ("Water meter", "Coarse water filter", "Pressure reducer", "Check valve"; "Suv hisoblagichi", "Dag'al filtr" va hokazo). Inglizcha ilovada ochib ko'rilmadi |
| 6 ⭐ | ✅ Belgi o'chirilganda qatorlar smetadan yo'qoladi va summa 21 987 530 ga qaytadi. Undo (panel yopiq holatda) belgini qaytaradi ([rasm](img/2026-11-14-suv-kirish-uzeli/06-undo-back-on.jpg)) |
| 7 | tekshirilmadi: admin hisobi bilan kirilmadi |

## Qo'shimcha kuzatuv

- Birinchi urinishda uzel belgisi yoqildi va smetada qatorlari chiqdi. Smetadan 3D'ga qaytib boyler bosilgach, uzel belgisi **o'chiq** ko'rindi. Belgini qayta yoqib, ketma-ketlikni takrorladim: panelni yopib ochish, smetaga borib qaytish, boylerni yoqib o'chirish. Belgi hamma safar saqlandi. Kodda belgini o'chiradigan joy topilmadi (`SantexnikaSection.tsx` faqat `waterInlet` ni o'zi o'zgartiradi). Ehtimol, bu mening sun'iy bosishim bo'lgan, lekin aniq emas. Haqiqiy telefonda bir marta qarab ko'rish kerak.
