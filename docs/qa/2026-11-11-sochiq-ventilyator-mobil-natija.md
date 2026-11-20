# Sochiq quritgich va ventilyator: mobil tekshiruv natijasi (2026-11-11)

Ro'yxat: [2026-11-10-sochiq-quritgich-ventilyator-mobil-tekshiruv.md](2026-11-10-sochiq-quritgich-ventilyator-mobil-tekshiruv.md). Issue: #233.

**Muhit:**
- Qurilma: iOS Simulator, iPhone 17 Pro, iOS 26.
- Ilova: andoza_ai_mobile `main` (`5960db2`), versiya 1.0.0+31 (Play'dagi bilan bir xil).
- Server: production `andozaai.uz`, #230 (ichida #231, #232) deploy qilingandan keyin.
- Xonalar: "Hammom namunasi" → "Hammom" (2.5 × 2.0 m) va "Mening xonam" (mehmonxona).
- Til: English. 2.8, 4.7 va ruscha PDF Русский'da tekshirildi.

> ⭐ bandlar haqiqiy telefonda tasdiqlanmagan. Simulyatorda barmoq harakati sun'iy yuboriladi.

> Tekshiruvdan keyin, issue'da so'ralganidek, quritgich o'chirildi va ventilyator belgisi yoqilgan holda qoldirildi. "Hammom" smetasi yana 19 309 510 so'm. Ilova tili English'ga qaytarildi.

## Qisqacha

| | Soni | Bandlar |
|---|---|---|
| ✅ | 28 | 1.1 ⭐, 1.2 ⭐, 1.5, 1.6, 1.9, 1.10, 2.1–2.5, 2.7, 2.8, 3.1–3.7, 4.1–4.3, 4.5, 4.7, 4.8 ⭐ (en, ru), 5.1, 5.2 |
| ⚠️ qisman | 2 | 1.3 ⭐, 1.4 ⭐ |
| ❌ telefonda bajarib bo'lmaydi | 2 | 1.7, 1.8 ⭐: ilovada Undo/Redo tugmasi yo'q |
| tekshirilmadi | 4 | 2.6, 4.4, 4.6, 5.3: web mantig'i, mobilga xos emas |

Web uchun 9 ta ish bor: [Web nima qilishi kerak](#web-nima-qilishi-kerak).

**Mobil kod uchun savolga javob.** Ilova xona holatini (`state`) faqat bir joyda yozadi: `lib/services/flat_scan_handoff.dart`. U skanerlangan kvartiraning **shu oqimda yangi yaratilgan** xonalariga faqat `layoutPos` yozadi. Backend PATCH butun `state`ni almashtiradi (`rooms.py:358`), lekin u paytda xonada `towelRails` ham, `designState.ventFan` ham hali yo'q. Boshqa joylar (`room_persistence_provider.dart`, `ai_builder_sheet.dart`, `project_menu.dart`) faqat `surfaces`, `ceilingH` yoki `name` yuboradi. Demak ilova bu ikki maydonni o'chirib yubormaydi.

## Natijalar

| # | Natija |
|---|---|
| 1.1 ⭐ | ✅ simulyatorda: ↖ → Plumbing → halqa oxiridagi "Add a point" → panel → "Add a towel rail". D devorida narvoncha paydo bo'ladi: 2 ta tik quvur va 6 ta ko'ndalang. Devorga yopishgan, havoda osilmagan ([rasm](img/2026-11-11-sochiq-ventilyator/05-rail-3d.png)) |
| 1.2 ⭐ | ✅ D devorida, eshik yonidagi burchakda, eshik ustida emas |
| 1.3 ⭐ | ⚠️ Quvurning o'ziga tegilsa, devor bo'ylab suriladi, kamera aylanmaydi, balandligi o'zgarmaydi. Lekin: (a) quvurlar ingichka, telefonda tegish qiyin. Zinalar orasiga tegilsa, kamera aylanadi. (b) Oldinda boshqa narsa bo'lsa, masalan vannaning shisha to'sig'i, teginish unga ketadi va "Vanna 1" tanlanadi ([rasm](img/2026-11-11-sochiq-ventilyator/07-glass-takes-touch-vanna-tooltip.png)). 2-ishga qarang |
| 1.4 ⭐ | ⚠️ Devor oxiridan chiqib ketmaydi ✅. Eshik tomonga surilganda esa eshik chetida **to'xtamaydi**: barmoq eshik o'rtasidan o'tishi bilan quritgich eshikning narigi tomoniga sakraydi ([rasm](img/2026-11-11-sochiq-ventilyator/08-rail-jumped-over-door.png)). Eshik ustida qolmaydi, lekin ro'yxatdagi "eshik chetida to'xtaydi" bajarilmaydi. 3-ishga qarang |
| 1.5 | ✅ Pastki ikki burchakda 2 ta qizil nuqta, quritgich bilan birga yuradi |
| 1.6 | ✅ "Show pipe runs" yoqilganda devor bo'ylab qizil va ko'k chiziqlar chiziladi |
| 1.7 | ❌ Ilovada Undo/Redo tugmasi yo'q. Studio'da Undo faqat Ctrl/⌘+Z bilan ishlaydi (`StudioPage.tsx:200–217`). Simulyatorning apparat klaviaturasidan ⌘Z/⌘⇧Z yuborilganda mantiq to'g'ri: Undo quritgichni olib tashlaydi, Redo qaytaradi. 1-ishga qarang |
| 1.8 ⭐ | ❌ telefonda (1.7 bilan bir sabab). ⌘Z bilan: uzoq surishdan keyin bitta Undo quritgichni boshlang'ich joyiga qaytardi, oraliqda to'xtamadi |
| 1.9 | ✅ Ilova butunlay yopilib qayta ochilganda quritgich ham, ventilyatorning o'chirilgani ham joyida |
| 1.10 | ✅ D devori kesib tashlangan tomonda bo'lganda quritgich va uning nuqtalari ko'rinmaydi ([rasm](img/2026-11-11-sochiq-ventilyator/06-wall-cut-rail-hidden.png)) |
| 2.1 | ✅ "HEATED TOWEL RAIL" sarlavhasi va "Add a towel rail" tugmasi. Panel endi pastdan chiqadi, plitka natijasidagi 1-ish tuzatilgan |
| 2.2 | ✅ "wall D · 100 cm · Remove" |
| 2.3 | ✅ 2 ta "Hot water · wall D · 100 cm (the rail's)", "Remove" yo'q ([rasm](img/2026-11-11-sochiq-ventilyator/03-panel-rail-points.png)) |
| 2.4 | ✅ Water: 7 → 9 nuqta, ~23.9 → ~27.2 m ([rasm](img/2026-11-11-sochiq-ventilyator/04-panel-summary.png)) |
| 2.5 | ✅ "Remove" quritgichni, uning 2 nuqtasini va 3D shaklini olib tashlaydi. Xulosa 7 nuqta / ~23.9 m ga qaytadi |
| 2.6 | tekshirilmadi |
| 2.7 | ✅ "Mening xonam"da burchak menyusida Plumbing yo'q: 6 ta bo'lim, hammomda 7 ta ([rasm](img/2026-11-11-sochiq-ventilyator/14-living-arc-no-plumbing.png)) |
| 2.8 | ✅ «Полотенцесушитель», «Добавить полотенцесушитель», «(сушителя)», «Вытяжной вентилятор» ([rasm](img/2026-11-11-sochiq-ventilyator/13-ru-panel.png)). Kichik kamchilik: "Тип" maydonida «Канализац» kesilgan (7-ish) |
| 3.1 | ✅ "Extractor fan" belgisi hech narsa qilmasdan yoqilgan |
| 3.2 | ✅ "Electrics and lighting"da: "Extractor fan" 1 pc × 180 000, "Electric cable (fan)" 3 m × 9 500, "Work: fitting the extractor fan" 1 pc × 100 000 ([rasm](img/2026-11-11-sochiq-ventilyator/02-fan-lines.png)) |
| 3.3 | ✅ Ventilyator va kabelda "approximate" belgisi va ogohlantirish bor |
| 3.4 | ✅ O'chirilganda uchala qator yo'qoladi: Electrics 1 011 500 → 703 000, jami −308 500 ([rasm](img/2026-11-11-sochiq-ventilyator/12-fan-off-estimate.png)) |
| 3.5 | ✅ Qayta yoqilganda qatorlar qaytadi |
| 3.6 | ✅ "Mening xonam" smetasida faqat "Electrical cable" ([rasm](img/2026-11-11-sochiq-ventilyator/15-living-estimate-no-fan.png)) |
| 3.7 | ✅ 3D'da ventilyator chizilmaydi |
| 4.1 | ✅ "Heated towel rail" 1 pc × 650 000 ([rasm](img/2026-11-11-sochiq-ventilyator/09-estimate-rail-line.png)) va "Work: fitting the towel rail" 1 pc × 200 000 ([rasm](img/2026-11-11-sochiq-ventilyator/11-rail-work-line.png)) |
| 4.2 | ✅ "PPR water pipe Ø20": 9 points: … + 2.35 + 2.85 m × 1.15 = 29.92 m ([rasm](img/2026-11-11-sochiq-ventilyator/10-ppr-9-points.png)) |
| 4.3 | ✅ "Fittings" va "Work: connecting a point": 11 → 13. Santexnika jami +1 213 820 so'm, bu qo'shilgan qatorlar yig'indisiga aynan teng |
| 4.4 | tekshirilmadi |
| 4.5 | ✅ O'chirilgandan keyin Santexnika 14 948 500 ga, jami 19 309 510 ga qaytdi |
| 4.6 | tekshirilmadi |
| 4.7 | ✅ «Полотенцесушитель», «Работа: установка полотенцесушителя», «Вытяжной вентилятор», «Электрокабель (вентилятор)», «Работа: установка вентилятора» |
| 4.8 ⭐ | ✅ simulyatorda, en va ru: "Download PDF" ulashish oynasini ochadi. Yangi qatorlar PDF'da o'sha tilda. Eski kamchiliklar qolgan: "Qty" ustuni kasrsiz, ruschada «Фитинги» ustma-ust (5- va 6-ishlar) |
| 5.1 | ✅ Bu yangilanishdan oldin saqlangan "Hammom" xatosiz ochildi, quritgich yo'q, ventilyator yoqilgan ([rasm](img/2026-11-11-sochiq-ventilyator/01-old-bathroom-opens.png)) |
| 5.2 | ✅ Faqat "Electrics and lighting"ga ventilyatorning 3 qatori qo'shildi (703 000 → 1 011 500), santexnika o'zgarmagan. "Wall preparation" 370 000 → 328 000 bo'lgani #228 ning ishi ("plitka ostiga shpaklyovka yo'q"), bu PR'niki emas |
| 5.3 | tekshirilmadi |

## Web nima qilishi kerak

1. **(Muhim) Telefonda Undo/Redo yo'q.** Studio'da Undo faqat klaviatura bilan ishlaydi (`StudioPage.tsx:200–217`), ilovada esa klaviatura yo'q. Bu faqat quritgichga emas, butun Studio'ga tegishli. Embedded/mobil ko'rinishda Undo va Redo tugmalari kerak, masalan pastki panelda yoki ⋮ menyuda.
2. **Quritgichni barmoq bilan ushlash qiyin.**
   - Quvurlar ingichka va ular orasidagi bo'shliq teginishni olmaydi, shuning uchun kamera aylanib ketadi. Narvoncha atrofiga ko'rinmas, kattaroq teginish maydoni kerak.
   - Oldidagi narsa (vannaning shisha to'sig'i) teginishni o'ziga oladi.
3. **Quritgich eshikdan sakrab o'tadi.** Surish paytida barmoq eshik o'rtasidan o'tishi bilan quritgich eshikning narigi tomoniga o'tadi (ehtimol `nearestFree` eng yaqin bo'sh oraliqni tanlaydi). Ro'yxatda "eshik chetida to'xtaydi" deyilgan. Surish davomida quritgich boshlangan oraliqda qolsin. Agar sakrash ataylab qilingan bo'lsa, ro'yxatni yangilash kerak.
4. **Jihoz ma'lumot oynasida o'zbekcha nom.** English'da vannaga tegilganda "Vanna 1 · 1.70 × 0.70 m · 4,500,000 UZS" chiqadi ([rasm](img/2026-11-11-sochiq-ventilyator/07-glass-takes-touch-vanna-tooltip.png)). Smetada esa nom tarjima qilingan ("Bathtub 1").
5. **PDF'da "Qty" ustuni haliyam kasrsiz** (plitka natijasidagi 3-ish): 29.92 m → "29", 5.94 m² → "5", 15.27 m² → "15". Sababi `backend/app/routers/estimate.py:782` dagi `_fmt_num` `int(n)` qiladi.
6. **Ruscha PDF'da «Фитинги» qatorida «13» va «комплектов» ustma-ust chiqadi.** Inglizchada "sets" qisqa bo'lgani uchun tuzalgan ko'rinadi, ruschada esa qolgan.
7. **Ruscha panelda "Тип" maydoni tor:** «Канализация» o'rniga «Канализац» ko'rinadi ([rasm](img/2026-11-11-sochiq-ventilyator/13-ru-panel.png)).
8. **Smetadagi izoh qatorlari qorong'i fonda haliyam deyarli ko'rinmaydi** (plitka natijasidagi 5-ish): "Approximate price — …", "of which approximate: …".
9. **Tekshirish uchun savol (tasdiqlanmagan): Undo'dan keyin avtosaqlash ishlaydimi?** Avtosaqlash faqat `isDirty` bo'lganda ishlaydi (`StudioPage.tsx:348`). Undo esa xona maydonlarini qaytaradi, lekin `isDirty`ni yoqmaydi: u zundo `partializeTemporal` ichida emas, slice'lar uni o'zi qo'yadi. Demak saqlashdan keyin Undo qilib, boshqa hech narsa o'zgartirmasa, Undo natijasi serverga yozilmasligi mumkin. Simulyatorda buni aniq tasdiqlab bo'lmadi, chunki WebView rasmni bir qadam kech chizadi.

**Avvalgi natijalardan tuzatilganlari:** Santexnika paneli endi pastdan chiqadigan oyna. "+ Add a point"da bitta plus. Smeta va PDF'da jihozlar nomi tarjima qilingan. Inglizcha PDF'da "Fittings" ustma-ust tushmaydi.

## Qayta tekshiruv: #235, #236, #237 dan keyin (2026-11-11, 12:10–12:25)

Ilova o'sha (1.0.0+31), server production. Ilova qayta ishga tushirildi, WebView yangi kodni oldi. Ochilganda "Hammom"da quritgich bor edi: kechqurun o'chirilgan edi, demak oraliqda kimdir qo'shgan (web tomondagi tekshiruv bo'lsa kerak).

| Web ishi | Natija |
|---|---|
| 1. Undo/Redo telefonda yo'q | ✅ ⋮ yonida ikkita tugma bor. Qiladigan ish bo'lmaganda o'chiq turadi ([rasm](img/2026-11-11-sochiq-ventilyator/16-recheck-undo-redo-buttons.png)). Surishdan keyin Undo yonadi, bosilganda quritgich oldingi joyiga qaytadi va Redo yonadi |
| 2. Quritgichni ushlash qiyin | ✅ Zinalar orasidan ushlansa ham quritgich suriladi, kamera aylanmaydi. Santexnika bosqichidan tashqarida vannaga tegilsa vanna tanlanadi, quritgich teginishni olmaydi |
| 3. Eshikdan sakrab o'tadi | ✅ Burchakdan eshik tomonga surildi, barmoq eshik ustidan o'tib ketdi, quritgich eshik chetida to'xtadi ([rasm](img/2026-11-11-sochiq-ventilyator/18-recheck-rail-stops-at-door.png)) |
| 4. Ma'lumot oynasida "Vanna 1" | ✅ "Bathtub 1 · 1.70 × 0.70 m · 4,500,000 UZS" ([rasm](img/2026-11-11-sochiq-ventilyator/19-recheck-bathtub-tooltip.png)) |
| 5. PDF'da miqdor kasrsiz | ✅ en PDF: 5.94 m², 5.4 m², 15.27 m², 8.68 m, 2.9 m, 30.27 m |
| 6. Ruscha PDF'da «Фитинги» ustma-ust | ➖ ruscha PDF bu safar yuklanmadi. Inglizcha PDF'da birlik ustuni kengaygan, ustma-ust tushish yo'q |
| 7. Ruscha "Тип" maydoni tor | ✅ "Kind" maydoni endi alohida, to'liq qatorda ([rasm](img/2026-11-11-sochiq-ventilyator/17-recheck-kind-row.png)). Ruschada ko'rilmadi |
| 8. Izohlar ko'rinmaydi | ✅ yorug' mavzuda: "Approximate price — …" va "of which approximate: …" sariq-jigarrang, "approximate" belgisi och fonda ([rasm](img/2026-11-11-sochiq-ventilyator/20-recheck-notes-colour.png)). Studio bugun yorug' mavzuda ochildi, tizimni qorong'iga o'tkazish uni o'zgartirmadi, shuning uchun qorong'i mavzu ko'rilmadi |
| 9. Undo natijasi saqlanmaydi | ✅ Surish → Undo tugmasi → ilova butunlay yopildi va qayta ochildi: quritgich Undo qaytargan joyda turibdi |

**Yangi kuzatuv (kichik, tasdiqlanmagan).** Bir marta quritgich surilgandan keyin devorning doira menyusi (Wallpaper / Tile / Window / Door) ham ochilib qoldi. Bundan oldingi teginish quritgichni qimirlatmagan edi, chunki u allaqachon eshik chetida turgan edi. Menyu o'sha teginish yoki surishning tugashi bilan ochilgan bo'lishi mumkin. Keyingi ikki surishda bu qaytarilmadi.

Tekshiruvdan keyin quritgich yana o'chirildi, ventilyator yoqilgan qoldi (issue'dagi holat).

## Mobil tomonda qolgan ish

Bosh sahifadagi "Hammom namunasi" kartasida smeta haliyam **17.5M**, Studio'da esa **19 309 510 so'm**. Karta ilovaning o'z taxminiy hisobini ko'rsatadi (`roomEstimateTotalProvider`), u santexnika, plitka va ventilyatorni bilmaydi.
