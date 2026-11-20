# Stoyakni surish: mobil ilovada tekshirish ro'yxati (2026-11-13)

**Kimga:** mobil tomon (andoza_ai_mobile), iOS'da tekshirish uchun.
**Server:** production `andozaai.uz`, stoyak PR'i merge va deploy qilingandan keyin.
**Sinov xonasi:** "Hammom namunasi" → **Hammom** (bitta eshik). Tekshiruvdan keyin stoyakni **"Avtomatik"** tugmasi bilan joyiga qaytaring.

> ⭐ belgili bandlar 3D va barmoq bilan surish: ular faqat avtomatik testlar bilan tekshirilgan, hech kim ekranda ko'rmagan.

## Tekshirishdan oldin
1. Ilovani to'liq yoping va qayta oching.
2. Tilni avval **English**, keyin **Русский** qiling.
3. Har bandning **Natija** ustuniga ✅ yoki ❌ va izoh yozing. ❌ bo'lsa, skrinshot qo'shing.

## 1. Stoyak 3D'da

| # | Qadamlar | Kutilgan natija | Natija |
|---|---|---|---|
| 1.1 ⭐ | ↖ menyu → Plumbing | Eshik yonidagi burchakda poldan shipgacha kulrang tik quvur (stoyak) ko'rinadi. Devorga yopishgan, devor ichiga kirmagan | |
| 1.2 ⭐ | Boshqa bosqichga o'ting (masalan, Bo'yoq), "Show pipe runs" o'chiq | Stoyak ko'rinmaydi | |
| 1.3 ⭐ | Plumbing bosqichida stoyakni barmoq bilan devor bo'ylab suring | Devor bo'ylab yuradi, kamera aylanmaydi | |
| 1.4 ⭐ | Uni burchakdan o'tkazib suring | Keyingi devorga o'tadi va o'sha devor bo'ylab davom etadi | |
| 1.5 ⭐ | "Show pipe runs" ni yoqing va stoyakni suring | Quvurlar yangi joydan boshlanadi, suring paytida qayta chiziladi | |
| 1.6 ⭐ | Uzoq suring → Undo bir marta | Stoyak surish boshlangan joyga qaytadi | |
| 1.7 | Stoyakni bosing (surmasdan) | Devor menyusi ochilmaydi | |

## 2. Panelda

| # | Qadamlar | Kutilgan natija | Natija |
|---|---|---|---|
| 2.1 | Santexnika paneli | **Riser** bo'limi: "Riser wall", "From the wall's start, cm" va **"Automatic (door corner)"** tugmasi (hozircha o'chiq). Pastida izoh: stoyakni 3D'da surish mumkin | |
| 2.2 | Devorni boshqasiga o'zgartiring | Stoyak o'sha devorga o'tadi; "Automatic" tugmasi yoqiladi | |
| 2.3 | Masofaga `120` yozib, Enter bosing | Stoyak devor boshidan 120 sm narida | |
| 2.4 | Masofaga devordan uzun son (`999`) yozing | Stoyak devor oxirida to'xtaydi, xato yo'q | |
| 2.5 | Pastdagi xulosaga qarang | Stoyak surilganda "Drain …, ~X m · Water …, ~Y m" metrlari o'zgaradi | |
| 2.6 | "Automatic" ni bosing | Stoyak eshik burchagiga qaytadi, tugma yana o'chadi | |
| 2.7 | Ruscha | "Стояк", "Стена стояка", "От начала стены, см", "Автоматически (угол у двери)" | |

## 3. Saqlash va smeta

| # | Qadamlar | Kutilgan natija | Natija |
|---|---|---|---|
| 3.1 | Stoyakni boshqa devorga qo'ying, saqlang, ilovani yopib qayta oching | Stoyak qo'yilgan joyida | |
| 3.2 | Smetani oching → "Plumbing" | Quvur metrlari panel xulosasi bilan bir xil (×1.15 bilan) | |
| 3.3 | Smeta PDF'i | PDF'da ham shu metrlar | |
| 3.4 | Stoyak qo'lda qo'yilgan xonaga yangi unitaz qo'shing | Unitaz stoyak yonidagi devorga qo'yiladi | |
| 3.5 | Yangi sochiq quritgich qo'shing | U stoyak yoniga qo'yiladi | |

## 4. Eski xonalar

| # | Qadamlar | Kutilgan natija | Natija |
|---|---|---|---|
| 4.1 | Bu yangilanishdan oldin saqlangan boshqa hammomni oching | Xatosiz ochiladi, stoyak eshik burchagida, "Automatic" tugmasi o'chiq, smeta o'zgarmagan | |
| 4.2 | Stoyak qo'lda qo'yilgan xonada eshikni boshqa devorga o'tkazing | Stoyak joyida qoladi (u endi foydalanuvchiniki) | |
