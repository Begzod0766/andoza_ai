# Kir yuvish mashinasi va pol trapi: mobil ilovada tekshirish ro'yxati (2026-11-13)

**Kimga:** mobil tomon (andoza_ai_mobile), iOS'da tekshirish uchun.
**Server:** production `andozaai.uz`, kir yuvish mashinasi va pol trapi PR'i deploy qilingandan keyin.
**Spec:** `docs/superpowers/specs/2026-11-13-kir-yuvish-trap-design.md`.
**Sinov xonasi:** "Hammom namunasi" → **Hammom**. Tekshiruvdan keyin qo'shilgan mashinalarni o'chiring va "Shower with no tray" belgisini o'chiq holiga qaytaring.

> ⭐ belgili bandlar 3D va barmoq bilan surish. Ular faqat avtomatik testlar bilan tekshirilgan, hech kim ekranda ko'rmagan. Ularni birinchi navbatda ko'ring.

## Tekshirishdan oldin
1. Ilovani to'liq yoping va qayta oching.
2. Tilni avval **English**, keyin **Русский** qiling.
3. Har bandning **Natija** ustuniga ✅ yoki ❌ va izoh yozing. ❌ bo'lsa, skrinshot qo'shing.
4. Hammom smetasining jami summasini yozib qo'ying.

## 1. Kir yuvish mashinasi 3D'da

| # | Qadamlar | Kutilgan natija | Natija |
|---|---|---|---|
| 1.1 ⭐ | ↖ menyu → Plumbing → panelda **Add a washing machine** | Devor yonida oq quti (60 × 60 × 85 sm), old tomonida to'q rangli dumaloq eshik. Quti devorga yaqin turadi, devor ichiga kirmaydi, hech qanday mebel bilan ustma-ust tushmaydi | |
| 1.2 ⭐ | Qayerga qo'yilganiga qarang | Stoyakka eng yaqin bo'sh joy. Eshik oldida emas, sochiq quritgich ostida emas | |
| 1.3 ⭐ | Mashinani barmoq bilan devor bo'ylab suring | Devor bo'ylab yuradi, kamera aylanmaydi, boshqa devorga sakramaydi | |
| 1.4 ⭐ | Uni eshik tomonga suring | Eshik chetida to'xtaydi, eshikdan o'tib ketmaydi | |
| 1.5 ⭐ | Uzoq suring → Undo bir marta | Surish boshlangan joyga qaytadi | |
| 1.6 | "Show pipe runs" ni yoqing | Mashina yonida 2 ta nuqta (ko'k sovuq suv ~90 sm, kulrang kanalizatsiya ~60 sm), quvurlar ularga boradi | |
| 1.7 | Ikkinchi mashina qo'shing | Birinchisi bilan ustma-ust tushmaydi | |
| 1.8 | Kamerani mashina turgan devor "kesilgan" tomonga o'tkazing | Mashina devor bilan birga yashirinadi | |
| 1.9 | Saqlang, ilovani qayta oching | Mashina joyida | |

## 2. Panelda

| # | Qadamlar | Kutilgan natija | Natija |
|---|---|---|---|
| 2.1 | Santexnika paneli | **Washing machine** bo'limi va **Add a washing machine** tugmasi | |
| 2.2 | Qo'shgandan keyin | Ro'yxatda "wall N" qatori va **Remove** tugmasi; nuqtalar ro'yxatida 2 ta qator "(the machine's)" yozuvi bilan, ularda Remove yo'q | |
| 2.3 | Pastdagi xulosa | Kanalizatsiya va suv nuqtalari 1 tadan oshgan | |
| 2.4 | Remove | Mashina, uning nuqtalari va 3D'dagi qutisi yo'qoladi | |
| 2.5 | Oshxona | Tugma oshxonada ham bor | |
| 2.6 | Ruscha | "Стиральная машина", "Добавить стиральную машину" | |

## 3. Smeta

| # | Qadamlar | Kutilgan natija | Natija |
|---|---|---|---|
| 3.1 | Bitta mashinali hammom smetasi → "Plumbing" | "Washing machine valve" (1 pcs), "Washing machine trap" (1 pcs), "Work: connecting the washing machine". Mashinaning o'zi narxlanmagan | |
| 3.2 | Quvur va fitinglar | "Wall outlet Ø20" 1 taga, "Work: connecting a point" 2 taga oshgan | |
| 3.3 | Ruscha | "Кран для стиральной машины", "Сифон для стиральной машины", "Работа: подключение стиральной машины" | |

## 4. Pol trapi

| # | Qadamlar | Kutilgan natija | Natija |
|---|---|---|---|
| 4.1 | Dushi bor hammomning Santexnika paneli | **Shower with no tray (floor drain)** belgisi bor, o'chiq. Dushi yo'q xonada bu belgi yo'q | |
| 4.2 | Yoqing, saqlang, smetani oching | "Shower tray trap" yo'q; uning o'rnida "Floor drain" va "Work: fitting the floor drain". Dush smesiteli joyida | |
| 4.3 | O'chiring, saqlang | Avvalgi holat qaytadi | |
| 4.4 | Ruscha | "Трап", "Работа: установка трапа", "Душ без поддона (трап)" | |

## 5. PDF va eski xonalar

| # | Qadamlar | Kutilgan natija | Natija |
|---|---|---|---|
| 5.1 | Smeta PDF'i (en, ru) | Yangi qatorlar PDF'da ham bor | |
| 5.2 | Bu yangilanishdan oldin saqlangan boshqa hammom | Xatosiz ochiladi, mashina yo'q, smeta o'zgarmagan | |
| 5.3 | Oxirida jami summa | Boshlang'ich holatga qaytarilgach, avvalgi summa bilan bir xil | |
