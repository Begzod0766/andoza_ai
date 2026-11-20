# Sochiq quritgich va ventilyator: mobil ilovada tekshirish ro'yxati (2026-11-10)

**Kimga:** mobil tomon (andoza_ai_mobile), iOS va Android'da tekshirish uchun.
**Server:** production `andozaai.uz`, #230 (ichida #231 va studiya PR'i) merge va deploy qilingandan keyin.
**Spec:** `docs/superpowers/specs/2026-11-10-sochiq-quritgich-ventilyatsiya-design.md`.
**Sinov xonasi:** xona turi **Hammom**, taxminan 2,5 × 2,0 m, bitta eshik. Ikkinchi xona sifatida istalgan mehmonxona.

> ⭐ belgili bandlarni faqat **haqiqiy telefonda** tasdiqlash mumkin. Ularni birinchi navbatda ko'ring: 3D ko'rinish va barmoq bilan surish faqat avtomatik testlar bilan tekshirilgan, hech kim brauzerda ko'rmagan.

## Tekshirishdan oldin
1. Ilovani to'liq yoping va qayta oching, shunda WebView keshi yangilanadi.
2. Ilova tilini avval **English**, keyin **Русский** qiling.
3. Har bir bandning **Natija** ustuniga ✅ yoki ❌ va izoh yozing. ❌ bo'lsa, skrinshot va qadamlarni qo'shing.

---

## 1. Sochiq quritgich 3D'da

| # | Qayerda | Qadamlar | Kutilgan natija | Natija |
|---|---|---|---|---|
| 1.1 ⭐ | 3D | ↖ burchak menyusi → Plumbing → "Add a point" → panelda **Add a towel rail** | Devorda xrom "narvoncha" paydo bo'ladi: 2 ta tik quvur va 6 ta ko'ndalang, eni ~50 sm, bo'yi ~80 sm, pastki cheti poldan ~1 m balandda. Devorga yopishgan, devor ichiga kirmagan va havoda osilmagan | |
| 1.2 ⭐ | 3D | Qayerga qo'yilganiga qarang | Stoyak turgan devorda (eshik yonidagi burchak), stoyakdan ~60 sm narida. Eshik yoki deraza ustida emas | |
| 1.3 ⭐ | 3D | Quritgichni barmoq bilan devor bo'ylab suring | Devor bo'ylab suriladi, kamera aylanmaydi. Balandligi o'zgarmaydi | |
| 1.4 ⭐ | 3D | Uni eshik tomonga, keyin devor oxiriga suring | Eshik ustiga chiqmaydi, eshik chetida to'xtaydi. Devor oxiridan chiqib ketmaydi | |
| 1.5 | 3D | Quritgich yonidagi nuqtalarga qarang | Pastki ikki burchagida 2 ta qizil (issiq suv) nuqta bor. Ular quritgich bilan birga yuradi, alohida surilmaydi | |
| 1.6 | 3D | "Show pipe runs" belgisini yoqing | Ikkala nuqtadan stoyakkacha devor bo'ylab qizil chiziqlar chiziladi | |
| 1.7 | Bekor qilish | Qo'shing → Undo → Redo | Undo quritgichni olib tashlaydi, Redo qaytaradi | |
| 1.8 ⭐ | Bekor qilish | Uzoq suring → Undo (bir marta) | Quritgich surish boshlangan joyga qaytadi (oraliq joylarda to'xtamaydi) | |
| 1.9 | Saqlash | Saqlang, ilovani yoping va qayta oching | Quritgich joyida | |
| 1.10 | Kamera | Xonani aylantirib, quritgich osilgan devorni "kesib tashlangan" tomonga o'tkazing | Devor yashiringanda quritgich va nuqtalari ham yashirinadi | |

## 2. Sochiq quritgich panelda

| # | Qayerda | Qadamlar | Kutilgan natija | Natija |
|---|---|---|---|---|
| 2.1 | Panel | Hammomda Santexnika panelini oching | **Heated towel rail** sarlavhasi va **Add a towel rail** tugmasi bor | |
| 2.2 | Panel | Tugmani bosing | Ro'yxatda qator chiqadi: devor raqami va balandligi ("... wall · 100 cm"), yonida "Remove" | |
| 2.3 | Panel | Nuqtalar ro'yxatiga qarang | 2 ta "Hot water" qatori qo'shilgan, yonida "(the rail's)" yozuvi, "Remove" tugmasi yo'q | |
| 2.4 | Panel | Pastdagi xulosaga qarang | Suv nuqtalari soni 2 taga, quvur uzunligi ham oshgan | |
| 2.5 | Panel | Quritgich qatoridagi "Remove" ni bosing | Quritgich, uning 2 nuqtasi va 3D'dagi shakli yo'qoladi | |
| 2.6 | Panel | Tugmani ikki marta bosing | Ikkita quritgich qo'shiladi (ustma-ust tushishi mumkin; birini suring) | |
| 2.7 | Boshqa xona | Mehmonxonani oching | Burchak menyusida Plumbing yo'q; quritgich tugmasi ham yo'q | |
| 2.8 | Til | Ruscha | "Полотенцесушитель", "Добавить полотенцесушитель", "сушителя" | |

## 3. Ventilyator

| # | Qayerda | Qadamlar | Kutilgan natija | Natija |
|---|---|---|---|---|
| 3.1 | Panel | Hammomda Santexnika panelining pastiga qarang | **Extractor fan** belgisi bor va yoqilgan (hech narsa qilmasdan ham) | |
| 3.2 | Smeta | Hammom smetasini oching → "Electrics and lighting" bo'limi | 3 qator: "Extractor fan" (1 pcs), "Electric cable (fan)" (3 m), "Work: fitting the extractor fan" | |
| 3.3 | Smeta | Ventilyator va kabel qatorlariga qarang | Ikkalasida "~taxminiy" belgisi va ogohlantirish bor (do'konda belgilangan mahsulot bo'lmasa) | |
| 3.4 | Panel → Smeta | Belgini o'chiring, saqlang, smetani qayta oching | Uchala qator yo'q, jami summa kamaygan | |
| 3.5 | Panel → Smeta | Belgini qayta yoqing, saqlang, smetani oching | Qatorlar qaytgan | |
| 3.6 | Boshqa xona | Mehmonxona smetasini oching | Ventilyator qatorlari yo'q | |
| 3.7 | 3D | Hammomda 3D'ga qarang | Ventilyator chizilmaydi (faqat smetada) | |

## 4. Sochiq quritgich smetada

| # | Qayerda | Qadamlar | Kutilgan natija | Natija |
|---|---|---|---|---|
| 4.1 | Smeta | Bitta quritgichli hammom smetasi → "Plumbing" bo'limi | "Heated towel rail" (1 pcs) va "Work: fitting the towel rail" qatorlari bor | |
| 4.2 | Smeta | "PPR water pipe Ø20" qatoriga qarang | Formuladagi nuqtalar soni 2 taga oshgan, har biriga uzunlik yozilgan, oxirida "× 1.15" | |
| 4.3 | Smeta | "Fittings" va "Work: connecting a point" | Ikkalasida miqdor 2 taga oshgan | |
| 4.4 | Smeta | Ikkita quritgich qo'shing | "Heated towel rail" 2 pcs; fiting va ulash yana 2 taga oshadi | |
| 4.5 | Smeta | Quritgichni o'chiring, saqlang | Hamma quritgich qatorlari yo'qoladi, quvur va fitinglar avvalgi holiga qaytadi | |
| 4.6 | Smeta | "Faqat ta'mir" (mebelsiz) rejimi | Quritgich va ventilyator summada qoladi | |
| 4.7 | Smeta | Ruscha | "Полотенцесушитель", "Работа: установка полотенцесушителя", "Вытяжной вентилятор", "Электрокабель (вентилятор)" | |
| 4.8 ⭐ | PDF | Smeta PDF'ini yuklab oling (en, keyin ru) | Yangi qatorlar PDF'da ham bor, o'sha tilda | |

## 5. Eski xonalar

| # | Qayerda | Qadamlar | Kutilgan natija | Natija |
|---|---|---|---|---|
| 5.1 | Eski hammom | Bu yangilanishdan oldin saqlangan hammomni oching | Xona xatosiz ochiladi, quritgich yo'q, ventilyator belgisi yoqilgan | |
| 5.2 | Eski hammom | Uning smetasini oching | Faqat ventilyatorning 3 qatori qo'shilgan, qolgani o'zgarmagan | |
| 5.3 | Xona shakli | Quritgichli xonada devor uzunligini qisqartiring | Quritgich devor ichida qoladi (kerak bo'lsa suriladi), xato chiqmaydi | |
