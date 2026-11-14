# Stoyak surilganda kir yuvish mashinasi: mobil tekshiruv natijasi (2026-11-14)

Issue #271 (tekshiruv ro'yxati issue ichida).

**Muhit:**
- Qurilma: iOS Simulator, iPhone 17 Pro.
- Ilova: andoza_ai_mobile 1.0.2+35, debug build.
- Server: production `andozaai.uz`, master `fe21aaf8`. Tekshiruv paytida `02f0b413` (#278) deploy qilindi.
- Xona: "Hammom namunasi" → "Hammom".
- Til: Русский.

> ⭐ bandlar haqiqiy telefonda emas, simulyatorda ko'rildi. Barmoq harakati sun'iy yuboriladi.

> Tekshiruvdan keyin xona boshlang'ich holatiga qaytarildi: mashina olib tashlandi, stoyak D devorda 0 sm da. Jami summa: oldin **21 987 530**, oxirida **21 987 530** so'm.

## Qisqacha

| | Soni | Bandlar |
|---|---|---|
| ✅ | 2 | 1, 3 |
| ⚠️ | 1 | 1: chetga o'tgan mashina rakovina ustiga chiqadi |
| tekshirilmadi | 3 | 2 (surish paytidagi oraliq holatni kuzatib bo'lmadi), 4, 5 (qisman) |

**Asosiysi:** stoyak mashina turgan joyga qo'yilganda mashina chetga o'tadi. Undo esa bitta bosishda ikkalasini qaytaradi. Lekin mashina o'tgan joyda rakovina turgan bo'lsa ham, mashina uning ustiga chiqadi.

**Bu tekshiruvda topilgan jiddiyroq xato (#271 ga aloqasi yo'q):** Studio'da "Смета" dan "3D" ga qaytilganda xona eski nusxada ochiladi. Keyingi har qanday o'zgarish shu eski nusxani serverga yozib yuboradi. Pastda, alohida bo'limda.

## Natijalar

| # | Natija |
|---|---|
| 1 ⭐ | ✅/⚠️ Mashina C devorda, dush va rakovina orasida edi ([rasm](img/2026-11-14-stoyak-mashina/01-before-drag.jpg)). Stoyak barmoq bilan o'ng burchakdan mashina turgan joyga surildi. Qo'yib yuborilganda mashina stoyakdan o'ngga, eng yaqin bo'sh joyga o'tdi va "Сохранено" chiqdi. **Lekin** bu joyda rakovina turibdi: mashina rakovina bilan ustma-ust chiqdi ([rasm](img/2026-11-14-stoyak-mashina/02-riser-on-washer-spot.jpg)). Mashina joyini tanlashda faqat stoyak va devor chetlari hisobga olinadi, boshqa buyumlar olinmaydi. #261 dagi "surganda mashina buyumlar ustiga chiqadi" kuzatuvi bilan bir xil |
| 2 ⭐ | tekshirilmadi: sun'iy surishda oraliq kadrlarni kuzatib bo'lmadi |
| 3 ⭐ | ✅ Undo bitta bosishda stoyakni burchakka, mashinani esa asl joyiga qaytardi ([rasm](img/2026-11-14-stoyak-mashina/03-undo-both-back.jpg)) |
| 4 | tekshirilmadi |
| 5 | qisman: mashinali smetada #278 dagi yangi qatorlar chiqdi: rozetka (IP44) 70 000, kabel 3 m, rozetka o'rnatish ishi 50 000. Kran, sifon va ulash ishi bu safar qaytadan ko'rilmadi. Eslatma: bu uchta qator ruscha interfeysda o'zbekcha ko'rindi. Sababi: #278 tekshiruv o'rtasida deploy qilingan, WebView'da esa saytning eski JS fayli ochiq qolgan edi. Bu xato emas, sahifani yangilagach qayta qarash kerak |

## Topilgan xato: "Смета" → "3D" o'tishida eski holat qaytadi

**Qanday takrorlanadi:** ikki marta kuzatildi, ikkinchisi ataylab takrorlandi.
1. Santexnika panelida "Водонагреватель" va "Узел ввода воды" ni o'chiring, "Сохранено" chiqadi ([rasm](img/2026-11-14-stoyak-mashina/04-stale-before-off.jpg)).
2. ⋮ → "Смета" ni oching. Summa belgilar o'chiq deb hisoblangan, ya'ni server yangi holatni olgan ([rasm](img/2026-11-14-stoyak-mashina/05-stale-smeta-server-off.jpg)).
3. "3D" ga qayting va panelni oching: ikkala belgi **yana yoqiq**, undo tugmasi o'chiq ([rasm](img/2026-11-14-stoyak-mashina/06-stale-after-back-on.jpg)).
4. Endi istalgan o'zgarish, masalan mashina qo'shish, shu eski holatni serverga saqlaydi. Birinchi safar shunday bo'ldi: mashina qo'shilgach smetada o'chirilgan uzel va boyler qatorlari qaytib chiqdi (jami 25 715 720).

**Sababi (kod bo'yicha), `frontend/src/pages/studio/StudioPage.tsx`:**
- Xona `useQuery(["room", roomId])` dan olinadi.
- Avtosaqlashdan keyin `loadedAtRef.current = saved.updated_at` bo'ladi, lekin `["room", roomId]` keshi yangilanmaydi.
- "3D" ga qaytganda sahifa qayta ochiladi va kesh eski nusxani darhol beradi. Uning `updated_at` qiymati `loadedAtRef` ga teng emas, shuning uchun effekt `loadDraftState(eski state)` ni chaqiradi.

**Kim uchun xavfli:** Studio'da o'zgarish qilib, smetaga kirib, keyin yana o'zgarish qilgan har bir foydalanuvchi uchun. Uning oxirgi o'zgarishlari jimgina yo'qoladi. Kod saytdagi Studio bilan bir xil, shuning uchun xato faqat ilovada emas.

**Tuzatish yo'li (taklif):** muvaffaqiyatli saqlashdan keyin `queryClient.setQueryData(["room", roomId], saved)` qilish kerak. Yoki effektda faqat serverdagi nusxa `loadedAtRef` dan **yangiroq** bo'lsa yuklash kerak.
