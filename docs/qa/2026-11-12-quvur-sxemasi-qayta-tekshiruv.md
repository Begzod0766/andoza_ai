# Quvur sxemasi: qayta tekshiruv (2026-11-12)

Birinchi natija: [2026-11-12-quvur-sxemasi-mobil-natija.md](2026-11-12-quvur-sxemasi-mobil-natija.md). Issue: #244. Web tuzatishi: #246.

Web jamoasi so'ragani: 1.1, 1.3, 1.4 bandlarini va Santexnika panelini pastga surib qayta ko'rish.

**Muhit:**
- Qurilma: iOS Simulator, iPhone 17 Pro.
- Ilova: andoza_ai_mobile `main` (`54998f0`), versiya 1.0.0+33. Ilova to'liq yopilib, qayta ochildi.
- Server: production `andozaai.uz`, master `06c3ef3b` (#246 shu ichida).
- Xona: "Hammom namunasi" → "Hammom" (vanna, rakovina, unitaz, dush). Til: O'zbekcha.

> ⭐ bandlar haqiqiy telefonda emas, simulyatorda ko'rildi. Xonaga hech narsa qo'shilmadi va o'zgartirilmadi. Faqat "Quvur yo'llarini ko'rsatish" belgisi yoqildi, u saqlanmaydi. Panel xulosasi avvalgidek: "Kanalizatsiya: 4 nuqta, ~7.8 m · Suv: 7 nuqta, ~18.4 m".

## Qisqacha

| # | Natija |
|---|---|
| 1.1 ⭐ | ✅ Kanalizatsiya magistrali endi polda aniq ko'rinadi: to'q ko'kish-kulrang chiziq och pol rangidan ajralib turadi. Ko'k va qizil avvalgidek ✅ |
| 1.3 ⭐ | ✅ Qizil ko'kdan yuqorida, ustma-ust tushmaydi. Kanalizatsiya polda yotadi va endi ko'rinadi |
| 1.4 ⭐ | ✅ (ko'zda) Unitaz yonidagi kanalizatsiya bo'lagi dush tomonidagi bo'lakdan taxminan ikki barobar qalin ko'rinadi. Ikki bo'lak kameradan har xil masofada, shuning uchun aniq o'lchab bo'lmadi |
| Santexnika paneli | ✅ ✕ tugmali qator surganda tepada qoladi, ro'yxat yumaloq burchak ostiga kirmaydi, pastda bo'sh joy bor. ⚠️ Ikkita mayda nuqson bor, quyida |
| Paneldagi kanalizatsiya nuqtalari | ✅ Nuqta belgilari ham yangi to'q ko'kish-kulrang rangda |

## Tafsilotlar

### Santexnika paneli

Panel ochilganda ([rasm](img/2026-11-12-quvur-qayta/01-panel-tepa.jpg)) kanalizatsiya nuqtalari ko'k va qizildan farq qiladigan to'q ko'kish-kulrang belgida.

Pastga surilganda ([rasm](img/2026-11-12-quvur-qayta/02-panel-surilgan.jpg)):
- ✅ ✕ qatori joyida qoladi, ro'yxat uning ostidan o'tadi.
- ✅ Oxirgi qator (xulosa) ostida home indicator uchun bo'sh joy bor.
- ⚠️ **Yuqori chekka:** surilgan ro'yxatning bitta qatori (bu holda "Kanalizatsiya · A devor · 15 sm (jihozniki)") panelning yumaloq tepa chizig'idan **tashqarida**, 3D sahna ustida bir necha piksel ko'rinib turadi ([yaqindan](img/2026-11-12-quvur-qayta/03-panel-tepa-chekka.jpg)). Ro'yxat suriladigan qism panelning tepa chegarasidan yuqoriga chiqib, kesilmayapti.
- ⚠️ **Chap chekka:** ✕ qatoridan pastda, panelning chap chetida 1 pt kenglikdagi och rangli tik chiziq bor (rang `#423E62`, panel foni `#29253F`). Ikkala rasmda ham ko'rinadi. Ehtimol, suriladigan blokning chap chegarasi yoki scrollbar.

### Quvurlar 3D'da

Umumiy ko'rinish: [rasm](img/2026-11-12-quvur-qayta/04-quvurlar-umumiy.jpg).

- **1.1 / 1.3:** B devor bo'ylab ko'k va qizil plintusdan biroz baland yuradi, qizil ustida. Ular ostida, polda kanalizatsiyaning to'q ko'kish-kulrang chizig'i aniq ko'rinadi ([yaqindan](img/2026-11-12-quvur-qayta/05-kanalizatsiya-yaqin.jpg)). Avvalgi tekshiruvda bu chiziq pol bilan qo'shilib ketgan edi.
- **Kuzatuv (xato emas, savol):** dush tomonidagi kanalizatsiya bo'lagi devorga tegib emas, devordan taxminan 15–20 sm narida, polning o'rtasiga yaqinroq yuradi va qisqa bo'lib tugaydi. Bu atayin qilinganmi (dush trapidan stoyakka to'g'ri yo'l)?
- **1.4:** unitaz yonidagi bo'lak ([rasm](img/2026-11-12-quvur-qayta/06-unitaz-o110.jpg), pastki o'ng burchak) dush tomonidagidan sezilarli qalin. Kodda Ø110 uchun `lineWidth` 4, Ø50 uchun 2, ko'rinish shunga mos.

## Web uchun

Majburiy ish yo'q, #246 dagi asosiy tuzatish ishlayapti. Ixtiyoriy, kichik:

1. Santexnika paneli surilganda ro'yxat panelning tepa chegarasidan tashqariga chiqmasin (suriladigan qismga `overflow: hidden` yoki to'g'ri `clip`).
2. Panel chap chetidagi 1 pt och chiziqni olib tashlash.
3. Savol: dush kanalizatsiyasi devordan narida yurishi kerakmi?

## #250 dan keyin (2026-11-13)

Server: production master `1aaa7711` (#250 shu ichida). Ilova va xona o'sha.

| # | Natija |
|---|---|
| Panel yuqori chekkasi | ✅ Surilganda hech bir qator panelning yumaloq tepa chizig'idan chiqmaydi ([yaqindan](img/2026-11-12-quvur-qayta/09-panel-250-tepa-chekka.jpg)). ✕ qatori joyida, faqat uning ostidagi qism suriladi ([rasm](img/2026-11-12-quvur-qayta/08-panel-250-surilgan.jpg)) |
| Panel chap chekkasi | ✅ 1 pt chiziq yo'q, chap chet piksellari panel foni bilan bir xil ([rasm](img/2026-11-12-quvur-qayta/07-panel-250-tepa.jpg)) |
| Dush kanalizatsiyasi (savol 3) | Web tushuntirishi qabul qilindi: kodda devordan 4 sm narida, pol sathida. Old tomondan qaraganda chiziq B devorga yaqin yuradi. Avvalgi ko'rinish perspektiva tufayli bo'lgan |

### Yangi topilma: iOS WebView deploy'dan keyin eski Studio'ni ko'rsatdi

#250 deploy qilingandan keyin ilova to'liq yopilib qayta ochildi, lekin panel o'zgarmadi: chap chiziq joyida edi. Production'dagi `ThreeDPage-*.js` faylida tuzatish bor edi (`design-panel-scroll`). Simulyatorda ilovaning WebKit HTTP keshi (`Library/Caches/uz.andozaai.app/WebKit/NetworkCache`) o'chirilgandan keyingina yangi panel ko'rindi.

Sabab: `https://andozaai.uz/` (va `/studio/...`) javobida `Cache-Control` yo'q, faqat `ETag` va `Last-Modified` bor. Bunday holda WKWebView `index.html`ni evristik muddat davomida tekshirmasdan keshdan beradi. Natijada eski `index.html` eski JS fayllariga ishora qiladi. Foydalanuvchilar deploy'dan keyin bir necha soat yoki undan ham uzoqroq eski Studio'ni ko'rishi mumkin.

Web uchun taklif: nginx'da `index.html` (SPA fallback) uchun `Cache-Control: no-cache` qo'yish. Xeshli `assets/*` fayllari `immutable` bo'lib qolaveradi.

### Kuzatuv: xulosa raqamlari o'zgardi

Kesh tozalangandan keyin panel xulosasi `Kanalizatsiya: 4 nuqta, ~8.0 m · Suv: 7 nuqta, ~17.8 m` bo'ldi. Kesh tozalanmasdan oldin `~7.8 m` va `~18.4 m` edi. Nuqtalar ro'yxatida ham devor nomi o'zgardi: "Kanalizatsiya · D devor · 50 sm" endi "Kanalizatsiya · B devor · 50 sm". Xonaga hech narsa qo'shilmagan. Ehtimol, oldingi tekshiruvlar qisman eski keshdagi Studio'da o'tgan. Web jamoasi yangi raqamlar to'g'riligini tasdiqlashi kerak.
