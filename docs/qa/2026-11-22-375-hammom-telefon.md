# #375 hammom (QA #372 tuzatishlari): telefonda tekshiruv (2026-11-22)

**Nima tekshirildi:** web PR #375 (`fix/qa-372`), mobil QA #372 dagi kuzatuvlar uchun tuzatishlar:
- c: quritgich ustidan pinch;
- d: uzoq bosish devor menyusini ochmasligi;
- 3: panel/menyu yopilgandan keyingi birinchi harakat;
- 4: surishda kamera burilmasligi;
- 5: sahifa kattalashmasligi;
- 6: mashina va stoyak.

Yana #371 regressiyasi (a, b) ham tekshirildi.

**Muhit:**
- Qurilma: iOS Simulator, iPhone 17 Pro (402×874).
- Ilova: andoza_ai_mobile 1.0.3+36 debug build, prod'ga ulangan, egasining akkauntida (til: o'zbekcha).
  - Ilova qayta o'rnatilmadi, akkauntdan chiqilmadi.
- Server: production `andozaai.uz`.
  - Boshlashda `curl https://andozaai.uz/` → `index-CL8o7dWf.js` (17:02, kutilgani shu).
  - Xona to'liq yopilib qayta ochildi (17:03), WebView yangi bundle'ni yukladi.
  - Keyingi deploy (#372 hujjat merge, 17:09–17:11) ochiq xona sahifasini qayta yuklamadi. Barcha bandlar `index-CL8o7dWf.js` bilan ochilgan sahifada tekshirildi.
  - Oxirgi yakuniy tekshiruv (xonani qayta ochish, rasm 15) 17:16 da, #378 deploy'i (17:17–17:22) tugashidan oldin bo'ldi.
- Xona: hammom 2.5 × 2.0 m («Mening uyim», 5.0 m²).
  - A devorda ikki quritgich (50×80 sm, «chetidan 65 sm» va «chetidan 115 sm»), burchakda «Rakovina 3».
  - **Kir yuvish mashinasi bor** (oq quti).
  - **Stoyak bor**: B/C devorlar burchagida, ko'k vertikal quvur. Uni bosganda «Quvurlar» paneli ochiladi.
- **Bosqich: hamma bandlar «Tayyor xona» bosqichida tekshirildi.** Har bir rasmda yuqori chapda «Bosqich: Tayyor xona» ko'rinadi. Faqat xabar chiqqan kadrda u xabar ostida qoladi, shuning uchun yonida oldingi kadr ham berilgan.
- Render, AI va boshqa pullik tugmalar bosilmadi.

> Simulatorda pinch'da ikkala barmoq **bir vaqtda** tegadi (topshiriqda shunday so'ralgan). Haqiqiy telefonda birinchi barmoq oldinroq tushishi mumkin.

## Natijalar

| # | Band | Bosqich | Natija | Nima ko'rildi |
|---|---|---|---|---|
| 1 | (c) Quritgich ustida ikki barmoq bir vaqtda: kamera yaqinlashadi, quritgich surilmaydi | Tayyor xona | ✅ | **2-quritgich** ustida pinch qilindi: kamera kuchli yaqinlashdi. «Orqaga» tugmasi faollashmadi, uzoqlashtirilgandan keyin quritgich joyida turibdi (rasm 03). **1-quritgich** ustida ham xuddi shunday (rasm 04). #372 dagi «pinch quritgichni surdi» xatosi takrorlanmadi. Pinchdan keyin A devor ko'k chiziq bilan belgilanib qoladi (pastdagi 6-kuzatuv). |
| 2 | (d) Quritgichni ~0.8 s uzoq bosib surish: devor menyusi chiqmaydi | Tayyor xona | ✅ | 2-quritgichning o'ng trubasi 0.8 s qimirlatilmay bosildi, keyin o'ngga surildi. **Quritgich surildi, devor menyusi ochilmadi**, kamera joyida qoldi (rasm 05). Surilish «orqaga» bilan qaytarildi. Trubalar orasidan uzoq bosish alohida sinalmadi. |
| 3 | (3) Panel yoki devor menyusi yopilgandan keyin birinchi harakat ishlaydi (undo ham) | Tayyor xona | ⚠️ | **Ko'p hollarda ishladi.** Ular quyida, keyin istisnolar. |
| | | | | Ishlagan hollar: × dan ~2 s keyingi birinchi bosish panelni ochdi (rasm 02). × dan keyingi birinchi harakat sifatida pinch (rasm 03), uzoq bosib surish (rasm 05) va «orqaga» tugmasi ishladi. Devor menyusi yopilgandan keyingi birinchi surish ham ishladi (rasm 12). |
| | | | | **Istisno 1:** × bosilgandan keyin juda tez (<0.5 s, panel yopilish animatsiyasi paytida) quritgichni bosish yo'qoldi. Ikkinchi bosish panelni ochdi. |
| | | | | **Istisno 2:** devor menyusi bo'sh joyni bosib yopildi. Darhol keyin stoyakni **birinchi bosish hech narsa qilmadi**, ikkinchisi «Quvurlar» panelini ochdi (rasm 13, keyin rasm 10 chap). Bu bir marta ko'rildi. |
| 4 | (4) Quritgichni surish kamerani burmaydi | Tayyor xona | ✅ | 2-quritgich 115 sm dan o'ngga surildi. Oldin/keyin rasmlarda xona burchaklari aynan bir xil pikselda (rasm 06). Uzoq bosib surish (rasm 05) va mashinani surish (rasm 09) da ham kamera qimirlamadi. #372 dagi «har surishda kamera biroz aylanadi» kuzatuvi takrorlanmadi. |
| 5 | (5) Yorliq/UI ustida pinch: butun sahifa kattalashmaydi | Tayyor xona | ✅ | Sahifa bir marta ham kattalashmadi, tugmalar o'lchami va joyi o'zgarmadi. **«Bosqich» tugmasi ustida** pinch qilinganda uning ro'yxati ochildi, xuddi bosilgandek (rasm 08 chap). U «Tayyor xona» tanlanib yopildi, bosqich o'zgarmadi. **Yuqori tugmalar qatori orasida** pinch qilinganda 3D kamera yaqinlashdi (rasm 08 o'ng). **O'ng pastdagi tugmalar karuseli ustida** pinch qilinganda karusel bir pozitsiyaga aylandi, sahifa kattalashmadi. Tayyor xona bosqichida 3D ichida `<Html>` yorliqlar yo'q edi, shuning uchun aynan yorliq ustida sinab bo'lmadi. |
| 6a | (6) Mashina ustida pinch: kamera yaqinlashadi, mashina surilmaydi; bir barmoq bilan surish ishlaydi | Tayyor xona | ✅ | Pinch'da kamera yaqinlashdi, «orqaga» faollashmadi (rasm 09 chap). Bir barmoq bilan surishda mashina surildi, kamera joyida qoldi (rasm 09 o'ng). Surilish «orqaga» bilan qaytarildi. |
| 6b | (6) Stoyak ustida pinch: kamera yaqinlashadi, stoyak surilmaydi | Tayyor xona | ✅ ⚠️ | Kamera yaqinlashdi, stoyak qimirlamadi, «orqaga» faollashmadi (rasm 10 o'ng). Lekin pinch oxirida **«Quvurlar» paneli ham ochildi**, pinch bosish deb qabul qilingandek. |
| 6c | (6) Stoyakni bir barmoq bilan surish ishlaydi | Tayyor xona | ❌ / ⚠️ | Stoyak ikki marta (qisqa va uzunroq) surildi. **Stoyak surilmadi**, «orqaga» faollashmadi. Uning o'rniga **kamera burildi** va barmoq qo'yilganda «Quvurlar» paneli ochildi (rasm 11, oldin/keyin). Stoyak «Tayyor xona»da ataylab qotirilgan bo'lishi ham mumkin. Boshqa bosqichga (masalan «Quvurlar») o'tib tekshirilmadi, chunki bosqich tanlovi prod'da saqlanishi mumkin. |
| 7a | #371 (a) Bo'sh joy yo'q: xabar bir marta chiqadi | Tayyor xona | ✅ | Holatni yaratish uchun 2-quritgich o'ng chegaraga (158 sm) surildi. «Rakovina 3» uning tagiga surildi: avval ~45 sm chapga (bunda quritgich o'ngga sakradi, 3-kuzatuv), keyin ~12 sm o'ngga. Keyin 2-quritgich chapga sudraldi. **Bitta** xabar chiqdi: «Quritgichni surib bo'lmaydi: bu devorda 50 sm bo'sh joy yo'q.» Quritgich qimirlamadi (rasm 12). Uzun, oldinga-orqaga surishda ham xabar bitta qoldi. |
| 7b | #371 (b) × dan keyin quritgichni bosish panelni qayta ochadi | Tayyor xona | ✅ | × → ~2 s → quritgichni bitta bosish → «Jihozlar» paneli ochildi (rasm 02). Bu jarayon yana 3 marta takrorlandi. Faqat × dan darhol keyingi (<0.5 s) bosish yo'qoldi (3-band, istisno 1). |

## Boshqa kuzatuvlar

1. **«Saqlanmadi» va «Qayta urinish» tugmasi bekor qilingan surishni qaytarib qo'ydi.** Eng muhim kuzatuv.
   - 2-quritgich surilgandan keyin toolbar'da «Saqlanmoqda…» yozuvi chiqdi va ~10 s turdi. Keyin «Saqlanmadi» + qizil «Qayta urinish» chiqdi (rasm 07, 1–2).
   - «Orqaga» bosildi: quritgich joyiga qaytdi, «Saqlanmadi» qoldi (rasm 07, 3).
   - Keyin «Qayta urinish» bosildi. Xato yo'qoldi, lekin **quritgich yana surilgan joyiga qaytdi**: «orqaga» faol, «oldinga» o'chiq (rasm 07, 4). «Qayta urinish» oxirgi muvaffaqiyatsiz saqlashni (surilgan holatni) qayta qo'llaganga o'xshaydi, foydalanuvchining «orqaga» qadamini hisobga olmagan.
   - Yana «orqaga» bosildi. Xona yopilib qayta ochildi: serverda 65 va 115 sm, ya'ni asl holat.
   - Saqlash nima uchun muvaffaqiyatsiz bo'lgani ko'rinmadi (WebView tarmog'ini kuzatib bo'lmadi). Qolgan surishlarda bunday xato chiqmadi.
2. **Saqlash holati chiqqanda toolbar tugmalari joyidan siljiydi.**
   - «Saqlanmoqda…» yoki «Saqlanmadi / Qayta urinish» chiqqanda «orqaga» va «oldinga» tugmalari chapga ko'chadi.
   - Natijada bir necha marta noto'g'ri tugma bosildi: «orqaga» o'rniga bo'sh joy bosildi, yozuv yo'qolgach «Qayta urinish» joyiga «oldinga» kelib qoldi.
   - Telefonda bosish nuqtasi qimirlamasligi kerak. Tavsiya: holat yozuvini alohida joyga qo'yish.
3. **Rakovina ustidagi quritgich chapga surilganda o'ngga sakradi.**
   - 7a uchun tayyorgarlikda rakovina 2-quritgich (158 sm) tagiga surildi. Rakovinaning o'ng tomonida joy qolgan edi.
   - 2-quritgich **chapga** sudraldi, lekin u **o'ng burchakka, 221 sm ga** sakradi (rasm 14). Xabar chiqmadi.
   - Chap tomonda 50 sm joy yo'q edi, shuning uchun funksiya yagona bo'sh joyni tanlagan bo'lishi mumkin. Lekin foydalanuvchi uchun bu «teskari tomonga sakrash» bo'lib ko'rinadi.
   - Bu «orqaga» bilan qaytarildi.
4. **Trubalar orasidan qisqa surish bir marta hech narsa qilmadi.**
   - Quritgich ham, kamera ham qimirlamadi. Keyin trubaning o'zidan surish ishladi.
   - Bu #371 dagi kabi «trubalar orasi»ga xos bo'lishi mumkin. Bir marta ko'rildi.
5. **«Jihozlar» tugmasi (o'ng pastda) panelni emas, jihoz qo'shish karuselini ochadi** («16 tadan 1», rakovina va dush rasmlari).
   - Undagi rasmni bosish jihoz qo'shishi mumkin. Hech narsa bosilmadi, karusel bo'sh joyni bosib yopildi.
   - Panel faqat jihozni bosganda ochiladi.
6. Pinch yoki surishdan keyin devor yoki pol konturi ko'k chiziq bilan belgilanib qoladi (rasm 03 o'ng, 06). Bu kichik vizual narsa.
7. Kir yuvish mashinasi oddiy oq quti ko'rinishida (eshigi faqat bir tomonda chizilgan). «Jihozlar» panelidagi ro'yxatda faqat «Rakovina 3» bor, mashina ro'yxatda yo'q.

## Prod'da o'zgartirilgan narsalar

Hammasi joyiga qaytarildi. Xona yopilib qayta ochilgandan keyin tekshirildi (rasm 15).

- **Hammom 2.5 × 2.0 m («Mening uyim», 5.0 m²):**
  - 2-quritgich:
    - 4-band: 115 → o'ngga → «orqaga».
    - Saqlash xatosi, «Qayta urinish» bilan qayta surildi → yana «orqaga».
    - 2-band: uzoq bosib → 158 sm. 7a: «orqaga» bilan **115 sm**.
    - 221 sm ga sakrash «orqaga» bilan qaytarildi.
  - «Rakovina 3»: 7a uchun ~45 sm chapga, keyin ~12 sm o'ngga surildi. Ikkalasi ham «orqaga» bilan aniq qaytarildi (burchakda).
  - Kir yuvish mashinasi: 6a da surildi, «orqaga» bilan qaytarildi.
  - Stoyak: qimirlamadi.
  - Yakuniy holat, qayta ochilgandan keyin: «A devor · chetidan 65 sm» va «A devor · chetidan 115 sm». Rakovina burchakda, mashina joyida, «orqaga» tugmasi o'chiq.
- Bosqich o'zgartirilmadi («Bosqich» ro'yxati ochilganda yana «Tayyor xona» tanlandi).

## Rasmlar

- 01. ![Tayyor xona: boshlang'ich ko'rinish va panel, 65 va 115 sm](img/2026-11-22-375-01-boshlangich-65-va-115-sm.png)
- 02. ![Tayyor xona: × dan keyin (chap), birinchi bosish panelni ochdi (o'ng)](img/2026-11-22-375-02-3-x-dan-keyin-birinchi-bosish-panel-ochildi.png)
- 03. ![Tayyor xona: 2-quritgich ustida pinch: oldin, zoom, uzoqlashtirilgandan keyin quritgich joyida](img/2026-11-22-375-03-c-pinch-2-quritgich-oldin-keyin-zoom-surilmadi.png)
- 04. ![Tayyor xona: 1-quritgich ustida pinch: oldin va zoom, «orqaga» o'chiq](img/2026-11-22-375-04-c-pinch-1-quritgich-zoom-surilmadi.png)
- 05. ![Tayyor xona: 0.8 s uzoq bosib surish: oldin (chap), quritgich surildi, menyu yo'q (o'ng)](img/2026-11-22-375-05-d-uzoq-bosish-oldin-keyin-surildi-menyu-yoq.png)
- 06. ![Tayyor xona: quritgichni surish: oldin va keyin, kamera burilmadi](img/2026-11-22-375-06-4-surish-oldin-keyin-kamera-burilmadi.png)
- 07. ![Tayyor xona: «Saqlanmoqda…», «Saqlanmadi», «orqaga»dan keyin, «Qayta urinish»dan keyin quritgich yana surilgan](img/2026-11-22-375-07-saqlanmadi-qayta-urinish-surishni-qaytardi.png)
- 08. ![Tayyor xona: «Bosqich» tugmasi ustida pinch, ro'yxat ochildi (chap); yuqori qatorda pinch, kamera zoom (o'ng)](img/2026-11-22-375-08-5-pinch-bosqich-tugmasi-va-yuqori-panel.png)
- 09. ![Tayyor xona: mashina ustida pinch, zoom (chap); mashinani bir barmoq bilan surish (o'ng)](img/2026-11-22-375-09-6-mashina-pinch-zoom-va-surish-ishlaydi.png)
- 10. ![Tayyor xona: stoyakni bosish, «Quvurlar» paneli (chap); stoyak ustida pinch, zoom va panel (o'ng)](img/2026-11-22-375-10-6-stoyak-bosish-va-pinch-quvurlar-paneli.png)
- 11. ![Tayyor xona: stoyakni surish: oldin (chap), keyin stoyak joyida, kamera burilgan, panel ochilgan (o'ng)](img/2026-11-22-375-11-6-stoyak-surish-oldin-keyin-surilmadi-kamera-burildi.png)
- 12. ![Tayyor xona: rakovina quritgich tagida (chap); surishda bitta xabar (o'rta); oldinga-orqaga surishdan keyin ham bitta (o'ng)](img/2026-11-22-375-12-a-oldin-keyin-xabar-bir-marta.png)
- 13. ![Tayyor xona: devor menyusi (chap); yopilgandan keyin stoyakni birinchi bosish, hech narsa (o'ng)](img/2026-11-22-375-13-3-devor-menyusidan-keyin-birinchi-bosish-yoqoldi.png)
- 14. ![Tayyor xona: rakovina 2-quritgich tagida (chap); chapga surilgan quritgich o'ngga sakradi (o'rta); panelda 221 sm (o'ng)](img/2026-11-22-375-14-chap-surish-quritgich-ongga-sakradi-221-sm.png)
- 15. ![Tayyor xona: yakuniy holat, qayta ochilgandan keyin 65 va 115 sm](img/2026-11-22-375-15-yakuniy-qayta-ochilgandan-keyin-65-va-115-sm.png)
