# Hammom santexnikasi: mobil ilovada tekshirish ro'yxati (2026-11-08)

**Kimga:** mobil tomon (andoza_ai_mobile), iOS va Android'da tekshirish uchun.
**Server:** production `andozaai.uz`, quyidagi PR'lar merge va deploy qilingandan keyin:
- #211: jihozlar va ularni joylash;
- #212: nuqtalar, "Santexnika" bosqichi, 3D;
- PR3: smetadagi "Santexnika" bo'limi.

**Spec:** `docs/superpowers/specs/2026-11-08-hammom-santexnika-design.md`.
**Sinov xonasi:** "Hammom namunasi" yoki yangi xona. Xona turi **Hammom**, taxminan 2,5 × 2,0 m, bitta eshik.

> ⭐ belgili bandlarni faqat **haqiqiy telefonda** tasdiqlash mumkin. Ularni birinchi navbatda ko'ring.

## Tekshirishdan oldin
1. Ilovani to'liq yoping va qayta oching, shunda WebView keshi yangilanadi.
2. Ilova tilini avval **English**, keyin **Русский** qiling.
3. Har bir bandning **Natija** ustuniga ✅ yoki ❌ va izoh yozing. ❌ bo'lsa, skrinshot va qadamlarni qo'shing.

---

## 1. Jihozlar katalogi va joylash

| # | Qayerda | Qadamlar | Kutilgan natija | Natija |
|---|---|---|---|---|
| 1.1 | Mebel paneli | Hammom xonasida mebel panelini oching | Faqat hammomga mos narsalar ko'rinadi (yotoqxona mebeli yo'q); **Plumbing / Сантехника** chipi bor | |
| 1.2 | Mebel paneli | "Plumbing" chipini bosing | Vanna, rakovina, unitaz, dush, bide ko'rinadi. "Vanna shkafi" kabi shkaflar bu yerda emas | |
| 1.3 | Joylash | Vanna qo'shing | Vanna eng uzun devor bo'ylab, orqasi devorga tegib turadi va eshikni to'smaydi | |
| 1.4 | Joylash | Dush qo'shing | Dush eshikdan eng uzoq burchakka tushadi | |
| 1.5 | Joylash | Unitaz, keyin rakovina qo'shing | Ikkalasi ham devorga suyangan, boshqa jihozga tegmaydi, oldida bo'sh joy qoladi | |
| 1.6 | Joylash | Unitazdan keyin bide qo'shing | Bide unitaz yonida, ~30 sm oraliqda, o'sha devorda | |
| 1.7 | Joylash | 4 ta jihozni ketma-ket qo'shing | Hech biri xona o'rtasida ustma-ust tushmaydi | |

## 2. Nuqtalar va 3D

| # | Qayerda | Qadamlar | Kutilgan natija | Natija |
|---|---|---|---|---|
| 2.1 | 3D | Vanna qo'yilgan | Orqa devorda 3 ta nuqta bor: kulrang (kanalizatsiya, pastda), ko'k (sovuq suv) va qizil (issiq suv) | |
| 2.2 | 3D | Unitaz qo'yilgan | Kulrang (Ø110) va ko'k nuqta bor, qizil yo'q | |
| 2.3 ⭐ | 3D | Vannani devor bo'ylab suring, keyin boshqa devorga burang | Nuqtalar vanna bilan birga yuradi va yangi devorga o'tadi | |
| 2.4 | 3D | Vannani o'chiring | Uning nuqtalari ham yo'qoladi; qo'lda qo'shilgan nuqta qoladi | |
| 2.5 ⭐ | 3D | Qo'lda qo'shilgan nuqtani barmoq bilan suring | Nuqta devor bo'ylab suriladi. Jihozning nuqtasi surilmaydi | |
| 2.6 | Bekor qilish | Vanna qo'ying → Undo | Vanna va uning 3 nuqtasi birga yo'qoladi; Redo ikkalasini qaytaradi | |
| 2.7 | Saqlash | Saqlang, ilovani yoping va qayta oching | Nuqtalar joyida | |

## 3. "Santexnika" bosqichi

| # | Qayerda | Qadamlar | Kutilgan natija | Natija |
|---|---|---|---|---|
| 3.1 | Bosqichlar | Hammom xonasida bosqichlar qatoriga qarang | "Montaj"dan keyin **Plumbing / Сантехника** bor. Mehmonxonada bu bosqich yo'q | |
| 3.2 | Panel | Bosqichni oching | Jihozlar ro'yxati va nuqtalar ro'yxati chiqadi; har bir nuqtada turi va devori yozilgan | |
| 3.3 | Panel | Qo'shish formasida turi "Sovuq suv", devori C, balandligi 90 sm deb kiriting → Qo'shish | Nuqta ro'yxatga va 3D'ga qo'shiladi | |
| 3.4 | Xulosa | Panel pastiga qarang | "Kanalizatsiya: N nuqta, X m · Suv: M nuqta, Y m" (zaxira bilan) | |
| 3.5 | Quvurlar | "Quvurlarni ko'rsatish" belgisini yoqing | 3D'da nuqtalardan stoyakkacha devor bo'ylab chiziqlar chiziladi. Panel yopilganda chiziqlar yo'qoladi | |
| 3.6 | Doira menyu | 3D'da doira menyuni oching | "Santexnika" bo'limida nuqtalar va "+ qo'shish" bor; qo'shish bosqich panelini ochadi | |

## 4. Smeta

| # | Qayerda | Qadamlar | Kutilgan natija | Natija |
|---|---|---|---|---|
| 4.1 | Smeta | Vanna, unitaz va rakovinali xonaning smetasini oching | "Elektr va yoritish"dan keyin **Plumbing / Сантехника** bo'limi (💧 belgisi, havorang) | |
| 4.2 | Smeta | Bo'limni oching | Jihozlar bu yerda turadi; "Mebel va jihozlar" bo'limida ular yo'q | |
| 4.3 | Smeta | Quvur qatorlariga qarang | "Drain pipe Ø50", "Drain pipe Ø110", "PPR water pipe Ø20" metrda; formulada har bir nuqtaning uzunligi va "× 1.15" ko'rinadi | |
| 4.4 | Smeta | Qolgan qatorlar | "Fittings" (har nuqtaga 1 komplekt), "Work: connecting a point", "Work: installing the bathtub" va boshqalar | |
| 4.5 | Smeta | Do'konda quvur bo'lmasa | Quvur qatorlarida "~taxminiy" belgisi va ogohlantirish bor | |
| 4.6 | Smeta | "Faqat ta'mir" (mebelsiz) rejimi | Santexnika bo'limi summada qoladi | |
| 4.7 | Smeta | Ruscha | Hamma qator va birlik ruscha: "точек", "комплект", "Канализационная труба Ø50" | |
| 4.8 ⭐ | PDF | Smeta PDF'ini yuklab oling (en, keyin ru) | PDF'da "Plumbing / Сантехника" bo'limi, qatorlar o'sha tilda | |
| 4.9 | Eski xona | Santexnika qo'shilishidan oldin saqlangan xonani oching | Xona ochiladi, nuqtalar yo'q, smeta xatosiz | |
