# Interaktiv Studio qo'llanmasi — «?» bajarib o'rgatadi

Sana: 2026-11-21 · Holat: dizayn (kod yo'q), egasi tasdiqlashi kutilmoqda · Yondashuv: o'z xonasida mashq

## Maqsad (egasining so'zi)

> «?» bosilganda pastda faqat matnli kartalar chiqadi (7 qadam: «Sahna — Devor yoki polga bosing…»).
> Qo'llanmani real qilib, ishlatib tushuntiradigan qilsak.

Egasi tanlagan:
- spotlight + «qo'l» imo-ishora animatsiyasi;
- asosiy 3 qadam interaktiv: foydalanuvchi o'zi bajaradi, keyingi qadam o'zi boshlanadi;
- mashq **foydalanuvchining o'z xonasida** bo'ladi (alohida namuna xonada emas).

## Hozirgi holat (kod bo'yicha)

- `frontend/src/components/studio/StudioTour.tsx` (#269, #273): spotlight allaqachon bor. Ekran 4 ta
  `bg-black/55 backdrop-blur-sm` bo'lak bilan qoraytiriladi, nishon `[data-tour=…]` oq halqa bilan
  o'raladi, karta nishonning tagida yoki ustida turadi. Strelka va animatsiya yo'q. Teshik (`data-tour-hole`)
  bosilsa, faqat «Keyingi» ishlaydi, sahnaga bosish o'tmaydi.
- Qadamlar `lib/studioTour.ts` → `STUDIO_TOUR_STEPS = scene, arc, menu, undo, lock, camera, help`.
  Faqat telefonda (`compact`) ishlaydi. Birinchi tahrirlash ko'rinishida o'zi ochiladi, «?» esa qayta ochadi.
  Tugaganini `localStorage` `studio.tour.v1.done` eslab qoladi.
- **«Sahna» qadami** butun 3D qutini (`data-tour="scene"`, `ThreeDPage.tsx`) yoritadi. Qoraytiriladigan joy
  qolmaydi, shuning uchun egasi uni «pastdagi matnli karta» deb ko'rgan.
- **Mebel qo'shish va bosqich almashtirish** uchun alohida qadam yo'q. Ular faqat «Bo'limlar» kartasida
  bitta qatorda tilga olinadi.
- Kuzatsa bo'ladigan holatlar:
  - devor yoki pol tanlandi: `ThreeDPage` → `focusSurface` / `setSelectedWall`, `SurfaceRadialMenu` ochiladi;
  - mebel qo'yildi: `roomStore.furniture` (`PlacedFurniture[]`) uzunligi oshdi;
  - bosqich almashtirildi: `roomStore.viewStage` (`MobileStagePicker` → `pickStage`).
- Ilova bilan aloqa: `notifyAppTour(open)` (Flutter kanali `AndozaStudioTour`) va `TOUR_SKIP_EVENT`
  (ilovaning tizim «Orqaga» tugmasi). Bu shartnoma o'zgarmaydi.

## Maqsadlar

- Yangi foydalanuvchi Studio'ning uchta asosiy harakatini **o'zi bajarib** o'rganadi:
  1. devor yoki polga bosish (asboblar chiqadi);
  2. mebel qo'shish;
  3. bosqichni almashtirish.
- Har bir interaktiv qadamda «qo'l» animatsiyasi aynan nima qilishni ko'rsatadi, matn bir qatorga qisqaradi.
- Qadam bajarilishi bilan keyingisi o'zi boshlanadi, «Keyingi» bosish shart emas.
- Qolgan 4 ta tugma (menyu, bekor qilish, qulf, kamera) qisqa, strelkali spotlight bo'lib qoladi.

## Maqsad emas (bu iteratsiyada)

- Kompyuterdagi (keng ekran) Studio uchun qo'llanma: hozirgidek faqat telefon.
- Rang, plitka va oboy tanlashni o'rgatish (1-qadam faqat asboblar menyusini ochishgacha).
- Video yoki GIF.
- Mobil ilova (Flutter) tomonida o'zgarish: hammasi web Studio ichida.

## Anti-maqsadlar (hech qachon bo'lmasligi kerak)

- Foydalanuvchining xonasi qo'llanmadan keyin uning roziligisiz o'zgarib qolishi.
- Qo'llanma tiqilib qolishi: nishon yo'qolsa, harakat bajarilmasa yoki ekran aylansa ham, har doim
  «O'tkazib yuborish» bor va qo'llanma osilib turmaydi.
- Qo'llanma paytida pullik narsa ishga tushishi (render, AI). Qo'llanma bunday tugmalarga olib bormaydi.
- Mashq qilinmagan, oldindan qo'yilgan mebelning o'chirilishi.

## Yondashuvlar

1. **O'z xonasida mashq (tanlandi).** Qo'llanma hozirgi Studio ustida ishlaydi va haqiqiy holatni kuzatadi.
   Oxirida mashqda qo'shilgan mebelni olib tashlashni so'raydi. Eng real yo'l va yozish arzonroq.
2. **Alohida namuna xona (rad etildi).** Haqiqiy loyihaga tegmaydi, lekin Studio'ga «saqlanmaydigan rejim»
   qo'shish kerak bo'ladi (autosave, serverdagi smeta). Ish ko'p, foydalanuvchi esa boshqa xonada o'rganadi.
3. **Faqat spotlight + animatsiya, interaktivsiz (rad etildi).** Arzon, lekin egasi aynan «ishlatib
   tushuntirish»ni so'radi.

## Dizayn

### Qadamlar

| # | Nishon | Turi | Nima ko'rsatiladi | Qachon keyingisi boshlanadi |
|---|---|---|---|---|
| 1 | sahna markazi (devor yoki pol) | interaktiv | «qo'l» devorga bosadi | foydalanuvchi devor, pol yoki shiftni tanlaydi (asboblar menyusi ochiladi) |
| 2 | yoydagi «Mebel» → xona turi → mebel | interaktiv | strelka + «qo'l» har bosiladigan joyni ko'rsatadi | `furniture` ichida qo'llanma boshida yo'q bo'lgan yangi id paydo bo'ldi |
| 3 | bosqichlar tugmasi (`MobileStagePicker`) | interaktiv | «qo'l» tugmani bosadi, keyin ro'yxatdan boshqa bosqichni | `viewStage` qo'llanma boshidagidan boshqa bosqichga o'zgardi |
| 4 | `menu` | ko'rsatish | strelka + 1 qator matn | «Keyingi» |
| 5 | `undo` | ko'rsatish | strelka + 1 qator matn | «Keyingi» |
| 6 | `lock` | ko'rsatish | strelka + 1 qator matn | «Keyingi» |
| 7 | `camera` | ko'rsatish | strelka + 1 qator matn | «Keyingi» |
| 8 | `help` | ko'rsatish | «Qo'llanmani istalgan payt qayta ko'ring» | «Tushunarli» → yakuniy savol (quyida) |

### Interaktiv qadamning ko'rinishi

```
┌──────────────────────────────┐
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│  ░ = qoraytirilgan
│░░░┌──────────────────────┐░░░│
│░░░│      3D sahna        │░░░│  ← teshik: bosish sahnaga o'tadi
│░░░│        👆 (bosadi)    │░░░│
│░░░└──────────────────────┘░░░│
│ ┌──────────────────────────┐ │
│ │ 1/8  Devorga bosing      │ │  ← bir qatorli karta
│ │            O'tkazib yub. │ │
│ └──────────────────────────┘ │
└──────────────────────────────┘
```

- Interaktiv qadamda teshik **bosishni o'tkazadi** (hozirgi «teshik = Keyingi» tugmasi o'rniga).
  Foydalanuvchi haqiqiy tugmani yoki sahnani bosadi.
- *(Mening qarorim.)* **1-qadamda faqat 3D kanvasning o'zi bosiladi.** Sahna qutisi ustidagi suzuvchi
  tugmalar bloklanadi: `CameraBar` (pullik 360 va render shu yerda), kamera ro'yxati, qulf, yoy va
  bosqichlar tugmasi. Devor tanlanib ✓ chiqqach, `SurfaceRadialMenu` yopiladi. Shuning uchun qo'llanma
  paytida bo'yoq, oboy, plitka, eshik va hokazo o'zgarishlar qilinmaydi, tozalash esa faqat mebelni qamraydi.
- *(Mening qarorim.)* Har bir interaktiv qadamda faqat shu qadamning joriy nishoni bosiladi, qolgan hamma
  narsa bloklangan.
- Karta bir qatorli bo'ladi: qadam raqami, qisqa buyruq va «O'tkazib yuborish». «Keyingi» tugmasi
  interaktiv qadamda yo'q, faqat harakat keyingi qadamni boshlaydi.
- «Qo'l» animatsiyasi CSS'da qilinadi (SVG qo'l + `@keyframes`: tushadi, bosadi, to'lqin chiqadi).
  Tashqi kutubxona kerak emas. `prefers-reduced-motion` bo'lsa, qo'l animatsiyasiz, qimirlamay turadi.
- 10 soniya hech narsa bosilmasa, «qo'l» qayta bir marta ko'rsatadi.
- Qadam bajarilganda qisqa «✓» belgisi chiqadi (taxminan 0,6 soniya), keyin keyingi qadamga o'tiladi.

### Ko'p bosqichli harakatlar (2- va 3-qadam)

Alohida «Bo'limlar» tugmasi yo'q: yopiq yoy kichik bo'lim tugmalarining o'zi (`tourId="arc"`).
Mebel ikki bosqichli halqa (`features/studio/useArcCategories.tsx`): «Mebel» xona turlarini
(mehmonxona, oshxona, yotoqxona, vanna, yuklanganlar) ochadi, xona turi esa mebellarni ochadi.
Spotlight har bosishdan keyin keyingi nishonga ko'chadi:
- 2-qadam: yoydagi «Mebel» → xona turlari halqasi → mebellar halqasi (halqa yoy bo'ylab suriladi,
  spotlight butun halqani yoritadi).
- 3-qadam: bosqichlar tugmasi → ochilgan ro'yxat.

Buning uchun yangi `data-tour` nishonlari qo'shiladi: yoydagi Mebel tugmasi, xona turlari halqasi,
mebellar halqasi, bosqichlar tugmasi va bosqichlar ro'yxati. Agar foydalanuvchi boshqa joyni bosib, menyu
yopilib qolsa, spotlight shu qadamning birinchi nishoniga qaytadi.

- *(Mening qarorim.)* Katalog bo'sh bo'lsa (Mebel ichida faqat «panel» bandi bor, masalan internet
  yo'q), 2-qadam tashlab ketiladi.
- *(Mening qarorim.)* Qaysi yo'l bilan qo'shilgan bo'lmasin (yoy, Mebel paneli), yangi id'li har qanday
  mebel 2-qadamni bajaradi va mashq mebeli sanaladi. Kuzatish `roomStore.furniture` id'larini qo'llanma
  boshidagi ro'yxat bilan solishtirish orqali qilinadi.
- *(Mening qarorim.)* 3-qadam: qo'llanma boshida ko'rinish «full» bo'lmasa ham, boshidagidan boshqa
  istalgan bosqich «almashtirildi» hisoblanadi.

### Mashq natijasini tozalash

- Qo'llanma ochilganda xona id'si, mavjud mebellarning id'lari, `viewStage` va `activePhase` eslab qolinadi.
- **Tugash tartibi** *(mening qarorim)*: avval bosqich va ochiq panel (`viewStage`, `activePhase`)
  qo'llanmadan oldingi holatga qaytariladi, shunda mashq mebeli ko'rinib turadi. Keyin, mashq paytida yangi
  mebel qo'shilgan bo'lsa, savol chiqadi: «Mashqda qo'shilgan mebel qoldirilsinmi?» — **[Olib tashlash]** /
  **[Qoldirish]**. Savol «Tushunarli» bosilganda ham, «O'tkazib yuborish» bosilganda ham chiqadi.
- «Olib tashlash» faqat qo'llanma paytida qo'shilgan id'larni o'chiradi (eski mebelga tegmaydi).
  Bu oddiy o'zgarish, bitta undo qadami bo'lib saqlanadi va autosave orqali serverga ketadi.
- Devor tanlovi va radial menyu: oxirida yopiladi (hozirgi `onEnd` kabi).

### Qo'llanma uzilib qolsa (egasi qarori, 2026-11-21: «olib tashlansin»)

Savol chiqmay tugagan har qanday holatda mashq mebeli **so'ramasdan olib tashlanadi**:
- ilovaning tizim «Orqaga» tugmasi (`TOUR_SKIP_EVENT`): savol ko'rsatilmaydi, mashq mebeli darhol
  o'chiriladi, bosqich qaytariladi. Flutter bilan shartnoma o'zgarmaydi;
- 3D ko'rinishdan chiqish yoki boshqa xonaga o'tish: komponent yopilayotganda xuddi shunday tozalanadi;
- ilova o'ldirilsa yoki sahifa yangilansa: qo'llanma davomida xona id'si va mashq mebeli id'lari
  `localStorage` ga yoziladi (`studio.tour.practice`). Studio shu xonani keyingi ochganida bu id'lar
  hali bor bo'lsa, ular o'chiriladi va yozuv tozalanadi. Savol javob berilgach yoki tozalash tugagach,
  yozuv ham o'chiriladi.

### Ishga tushish va eslab qolish

- Hozirgidek: telefonda birinchi tahrirlash ko'rinishida o'zi ochiladi, «?» qayta ochadi.
- Kalit `studio.tour.v2.done` bo'ladi, shuning uchun eski turni ko'rgan foydalanuvchilarga yangisi
  bir marta o'zi ochiladi.
- Mehmon rejimida ham ishlaydi: mebel qo'shish va bosqich almashtirish bepul.

### Tarjimalar

Yangi va qisqartirilgan matnlar `uz.json`, `ru.json` va `en.json` ga birga qo'shiladi
(`studio.tour.*`). Qo'llanmaning eski uzun matnlari olib tashlanadi.

## Quruvchiga qoldirilganlar

- «Qo'l» SVG'ining aniq ko'rinishi va animatsiya vaqtlari.
- Holatni kuzatish yo'li: `roomStore`'ga obuna bo'lish yoki `ThreeDPage` dan voqealar yuborish.
- Qo'llanmani nima boshqaradi: hozirgi `StudioTour` kengaytiriladimi yoki yangi komponent yoziladimi.
- Testlar: har bir qadamning «bajarildi» sharti, nishon yo'qolganda o'tkazib yuborish,
  mashq mebelini tozalash (eski mebelga tegmaslik), `prefers-reduced-motion`.
