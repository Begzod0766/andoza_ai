# Santexnika: suv va kanalizatsiya tizimi

Sana: 2026-10-25. Holat: tasdiqlash uchun.

## Muammo
Studiyada santexnika yo'q. Bor narsa — LiDAR skanerdan topilgan stoyak qutilari
(`frontend/src/lib/serviceFeatures.ts`), ular faqat 3D'da quti bo'lib turadi.
Katalogda 14 ta hammom modeli bor (Vanna 1–5, Rakovina 1–4, Dush 1–3, Bide, Unitaz),
lekin ular `boshqa` kategoriyasida, hech qaysi quvurga ulanmaydi. Smetada santexnika
guruhi yo'q.

## Maqsad
Professional santexnik loyihalagandek: suv manbai (stoyak, ixtiyoriy kotel), har bir
jihozning sovuq/issiq suv va kanalizatsiya nuqtasi, devor bo'ylab yo'naltirilgan
quvurlar, kanalizatsiya qiyaligi tekshiruvi va smeta.

**Muvaffaqiyat mezoni:**
- hammomga rakovina qo'yilsa, unga sovuq va issiq suv hamda Ø50 kanalizatsiya nuqtasi
  standart balandlikda o'zi paydo bo'ladi, quvurlar stoyakgacha chiziladi;
- mebel surilsa nuqtalar ham suriladi, quvurlar qayta hisoblanadi;
- o'z stoyagi yo'q oshxona qo'shni xonaning stoyagidan umumiy devor orqali suv oladi;
- kanalizatsiya qiyaligi yetmasa yoki unitaz stoyakdan uzoq bo'lsa ogohlantirish chiqadi;
- smetada "Santexnika" guruhi: quvur metrlari diametr bo'yicha, fitinglar va ish haqi
  nuqta bo'yicha, kotel;
- hozirgi barcha ishlar (devor, eshik, mebel, chiroq, elektr, fokus, autosave) o'zgarmaydi.

## Doira
**Kiradi:** xona holatidagi `plumbing` kaliti; katalogda `fixture_kind` maydoni;
standart nuqtalar jadvali; quvur yo'naltirish (sof funksiya); "Santexnika" tabi
(plan + 3D); asosiy 3D'da quvurlarni ko'rsatish tugmasi; smeta guruhi; qo'shni xona
orqali suv olish.

**Kirmaydi (keyingi bosqich):** kollektor (taroq), kranlar va filtrlar, kotel quvvatini
hisoblash, quvur diametrini gidravlik hisoblash, issiq pol, polotentsesushitel,
quvurni qo'lda chizish.

## 1. Saqlanadigan ma'lumot
Har bir xonaning `room.state` ichida, `electricals` yonida yangi `plumbing` kaliti:

```ts
interface PlumbingState {
  version: 1
  /** Xonadagi suv manbalari. Skaner topgan stoyak bu yerga yozilmaydi — u o'zi hisobga olinadi. */
  sources: PlumbingSource[]          // { id, kind: 'riser' | 'boiler', wallId, positionMm, heightMm }
  /** Qo'lda qo'shilgan qo'shimcha nuqtalar. */
  points: PlumbingPoint[]            // { id, kind: 'cold' | 'hot' | 'drain', wallId, positionMm, heightMm }
  /** Avtomatik nuqtaga qilingan o'zgarish; kalit `${furnitureId}:${kind}`. */
  overrides: Record<string, { heightMm?: number; offsetMm?: number; off?: boolean }>
  /** Suv qaysi qo'shni xonadan keladi; yo'q bo'lsa eng yaqini avtomatik tanlanadi. */
  feedFromRoomId?: string
  /** Saqlash paytidagi quvur uzunliklari — backend smetasi uchun (hosila, qayta hisoblanadi). */
  takeoff?: PlumbingTakeoff          // { ppr20M, ppr25M, pvc50M, pvc110M, points, boilers }
}
```

- Quvurlarning o'zi saqlanmaydi, har safar hisoblanadi.
- Nuqtalar rozetkalar kabi `wallId + positionMm` ga bog'lanadi.
- `plumbing` yo'q eski xona bo'sh santexnika bilan ochiladi. `version` keyingi o'zgarishlar uchun.

## 2. Jihozlar
- Backend `Furniture` jadvaliga `fixture_kind` (nullable) qo'shiladi:
  `sink | kitchen_sink | toilet | bathtub | shower | bidet | washer | dishwasher | boiler`.
- Migratsiya bor modellarni nomidan to'ldiradi: Rakovina→sink, Unitaz→toilet, Vanna→bathtub,
  Dush→shower, Bide→bidet.
- Admin katalog formasida maydon tanlanadi. API javobida `fixture_kind` qaytadi.
- Frontendda keshdagi eski javoblar uchun nomdan aniqlash zaxirasi bor.
- Skaner obyektlari (`sink`, `toilet`, `bathtub`, `washer`) ham shu turlarga o'tadi.

**Standart nuqtalar** (balandlik — toza poldan, mm; siljish — jihoz o'qidan):

| Jihoz | Sovuq | Issiq | Kanalizatsiya |
|---|---|---|---|
| Rakovina | 500, −100 | 500, +100 | Ø50, 500 |
| Oshxona moykasi | 500, −100 | 500, +100 | Ø50, 500 |
| Unitaz | 200, +200 | — | Ø110, 0 |
| Vanna | 800, −75 | 800, +75 | Ø50, 100 |
| Dush | 1100, −75 | 1100, +75 | Ø50, 0 |
| Bide | 200, −75 | 200, +75 | Ø50, 200 |
| Kir yuvish mashinasi | 600 | — | Ø50, 600 |
| Idish yuvish mashinasi | 500 | — | Ø50, 500 |
| Kotel | 1500 (kirish) | 1500 (chiqish) | — |

Nuqta jihozga eng yaqin devorga, jihoz orqasining o'rtasiga qo'yiladi. Jihoz surilsa nuqta ham suriladi.

## 3. Quvur yo'naltirish
Sof funksiya `frontend/src/lib/plumbingRoute.ts`, birlik testlari bilan.

- **Suv quvurlari** manbadan har bir nuqtagacha devor bo'ylab, devor ichidagi shtrobada,
  300 mm balandlikda yuradi, nuqtaga tik ko'tariladi. Sovuq ko'k, issiq qizil.
  Nuqtaga PPR Ø20, asosiy yo'l PPR Ø25.
- **Issiq suv** stoyakdan (markaziy) yoki xonada kotel bo'lsa kotel chiqishidan keladi.
  Kotel sovuq suvni stoyakdan oladi.
- **Kanalizatsiya** pol sathida devor bo'ylab stoyakka qarab pastlaydi: Ø50 — 2%, Ø110 — 1–2%.
  Kerakli tushish = uzunlik × qiyalik.
- **Ogohlantirishlar:**
  - tushish chiqish nuqtasi bilan stoyak kirishi orasidagi farqdan oshsa — "kanalizatsiya juda uzun";
  - unitaz stoyakdan 1 m dan uzoq bo'lsa;
  - nuqtaga manba topilmasa.
- **Qo'shni xona orqali:** stoyagi yo'q xona (o'zida ham, skanerda ham yo'q) umumiy devori bor,
  manbali qo'shnidan suv oladi (`feedFromRoomId` yoki eng yaqini). O'tish nuqtasi umumiy devorda,
  qo'shni manbaga eng yaqin joyda. Qo'shni xonaning yo'li shu nuqtagacha uzayadi.
  Hisob kvartiraning barcha xonalari keshdan (`['apt-rooms', aptId]`) olinib, ko'rsatish paytida qilinadi.
  Umumiy devorni topishda bor `flatBoxes` / `partitionDoors` mantiqidan foydalaniladi.

## 4. Interfeys
- Joylashtirish sahifasida Elektr va Chiroqlar yonida yangi **"Santexnika"** tabi.
- **Plan ko'rinishi:** quvurlar (ko'k, qizil, kulrang), nuqtalar, manbalar.
- **3D ko'rinishi:** quvurlar ingichka trubka.
- **Yon panel:** stoyak, kotel, qo'shimcha nuqta tugmalari; nuqtalar ro'yxati balandligi bilan
  (o'zgartirish, o'chirish); ogohlantirishlar.
- **Asosiy 3D studiyada** "quvurlarni ko'rsatish" tugmasi, sukut bo'yicha o'chiq — bugungi sahna o'zgarmaydi.
- Matnlar uz, ru, en tarjimalarida.

## 5. Smeta
- Frontend `smetaGroups.ts` ga `santexnika` guruhi qo'shiladi, o'z rangi bilan.
- Backend `smeta.py` `state.plumbing.takeoff` dan qatorlar yasaydi:
  PPR Ø20/Ø25 va PVX Ø50/Ø110 quvur metrlari, nuqta bo'yicha fitinglar va santexnik ish haqi, kotel.
- Narxlar bor material katalogidagi `santexnika` kategoriyasidan, topilmasa norma narxi.

## 6. Hozirgi ish bilan to'qnashmaslik
- Faqat bitta yangi kalit qo'shiladi; boshqa kalitlar o'zgarmaydi.
- `plumbing` autosave ro'yxatiga (`ROOM_CONTENT_KEYS`), saqlash so'roviga va `loadRoom` ga qo'shiladi —
  santexnika o'zgarishi o'zi saqlanadi.
- Xonani surish, o'lchamini o'zgartirish va L ga kesishda (`keepContent`, `clipRoom`) nuqta va manbalar
  rozetkalar bilan bir xil yo'l bilan joyida qoladi.
- Ulashilgan xona (`room_share.py`) ochiq kalitlariga `plumbing` qo'shiladi.
- Yangi kod alohida fayllarda: `store/slices/plumbingSlice.ts`, `lib/plumbing*.ts`,
  `pages/studio/placement/Santexnika*.tsx`, `three-d/PlumbingPipes.tsx`.
- Devor, eshik, mebel, chiroq, elektr va fokus kodi o'zgarmaydi.

## 7. Sinov
- Birlik testlari: standart nuqtalar, yo'naltirish, qiyalik ogohlantirishi, qo'shni xona orqali,
  `keepContent`/`clipRoom` dan keyin nuqtalar joyida, eski holat (`plumbing` yo'q) yuklanadi.
- Backend testlari: migratsiya nomdan to'ldirish, smeta qatorlari.
- Brauzerda: hammomga rakovina va unitaz qo'yish, quvurlar chiqishi, surish, autosave serverga yozishi,
  oshxona qo'shnidan suv olishi, smetada guruh.

## Bosqichlar
1. Ma'lumot, standart jadval, `fixture_kind` (backend + migratsiya).
2. Yo'naltirish va testlar.
3. Santexnika tabi — plan.
4. 3D quvurlar.
5. Smeta.
6. Qo'shni xona orqali.
