# Kir yuvish mashinasi va pol trapi: mobil tekshiruv natijasi (2026-11-14)

Ro'yxat: [2026-11-13-kir-yuvish-trap-mobil-tekshiruv.md](2026-11-13-kir-yuvish-trap-mobil-tekshiruv.md) (issue #261).

**Muhit:**
- Qurilma: iOS Simulator, iPhone 17 Pro.
- Ilova: andoza_ai_mobile 1.0.0+33. Debug build, oldin to'liq yopilib, qayta ochilgan.
- Server: production `andozaai.uz`, master `4ea7afe3`.
- Xona: "Hammom namunasi" → "Hammom".
- Til: English, ruscha bandlar Русский'da.

> ⭐ bandlar haqiqiy telefonda emas, simulyatorda ko'rildi. Barmoq harakati sun'iy yuboriladi.

> Tekshiruvdan keyin xona boshlang'ich holatiga qaytarildi: mashina o'chirildi, trap belgisi o'chiq. Jami summa: oldin **21 987 530**, oxirida **21 987 530** so'm.

## Qisqacha

| | Soni | Bandlar |
|---|---|---|
| ✅ | 20 | 1.2, 1.3, 1.5–1.9, 2.1–2.4, 2.6, 3.1–3.3, 4.1–4.4, 5.3 |
| ⚠️ | 2 | 1.1, 1.4: surganda mashina boshqa buyumlar ustiga chiqadi |
| tekshirilmadi | 3 | 2.5 (sinov loyihasida oshxona yo'q), 5.1 (mashinali holatda PDF olinmadi), 5.2 (boshqa eski hammom tanlanmadi) |

**Asosiysi:** mashina qo'yilganda to'g'ri joy topadi. Lekin uni barmoq bilan surganda boshqa buyumlar hisobga olinmaydi: mashina dush kabinasi ichiga ham, rakovina ustiga ham chiqib ketadi. Qolgan hammasi ishlaydi.

## Natijalar

| # | Natija |
|---|---|
| 1.1 ⭐ | ⚠️ Qo'shilganda C devor yonida oq quti paydo bo'ldi, old tomonida to'q rangli dumaloq eshik bor ([rasm](img/2026-11-14-kir-yuvish-santexnika/01-machine-added.jpg)). Quti devorga kirib ketmaydi. Tepadan qaraganda rakovina bilan yonma-yon turibdi, chetlari bir-biriga tegib turadi ([rasm](img/2026-11-14-kir-yuvish-santexnika/02-machine-top-view.jpg)). Asosiy muammo surishda chiqadi, 1.3 va 1.4 ga qarang |
| 1.2 ⭐ | ✅ Mashina dush va rakovina orasidagi bo'sh joyga qo'yildi. Eshik oldida emas. Xonada sochiq quritgich yo'q |
| 1.3 ⭐ | ✅ Devor bo'ylab yuradi, kamera aylanmaydi, boshqa devorga sakramaydi. **Lekin** yuqori burchak tomonga surilganda mashina **dush kabinasi ichiga** kirib, dush boshi va shisha bilan ustma-ust turadi ([rasm](img/2026-11-14-kir-yuvish-santexnika/03-drag-into-shower.jpg)) |
| 1.4 ⭐ | ⚠️ Eshik boshqa (D) devorda. C devor bo'ylab eshik tomonga surilganda mashina devor oxiri, ya'ni burchakda to'xtaydi va eshikka o'tmaydi. Lekin yo'lidagi **rakovina ustiga to'liq chiqadi** ([rasm](img/2026-11-14-kir-yuvish-santexnika/04-drag-over-sink.jpg)). Qo'yishda to'qnashuv tekshiriladi, surishda tekshirilmaydi |
| 1.5 ⭐ | ✅ Uzoq surishdan keyin Undo bir marta bosilsa, mashina boshlang'ich joyiga qaytadi. Ikki marta tekshirildi |
| 1.6 | ✅ Quvurlar mashinaga boradi. Ko'k sovuq suv nuqtasi (~90 sm) mashina tepasida ko'rinadi. Kulrang kanalizatsiya nuqtasi (~60 sm) mashina orqasida qoladi ([rasm](img/2026-11-14-kir-yuvish-santexnika/06-pipe-runs-points.jpg), [tepadan](img/2026-11-14-kir-yuvish-santexnika/05-pipe-runs-top.jpg)) |
| 1.7 | ✅ Ikkinchi mashina qo'shilmaydi, "No room on the walls for a washing machine." xabari chiqadi. Ustma-ust tushish yo'q |
| 1.8 | ✅ Kamera C devor tomonidan qaraganda devor "kesiladi" va mashina u bilan birga yashirinadi ([rasm](img/2026-11-14-kir-yuvish-santexnika/07-wall-cut-hides-machine.jpg)) |
| 1.9 | ✅ Studio'dan chiqib, ilova tili almashtirilib, xona qayta ochildi. Mashina joyida |
| 2.1 | ✅ "WASHING MACHINE" bo'limi va "Add a washing machine" tugmasi bor |
| 2.2 | ✅ "wall C" qatori va "Remove" tugmasi bor. Nuqtalar ro'yxatida 2 qator: "Cold water · wall C · 90 cm (the machine's)" va "Drain · wall C · 60 cm (the machine's)". Ularda Remove yo'q |
| 2.3 | ✅ Xulosa qatori: "Drain: 4 → 5 points, Water: 7 → 8 points" |
| 2.4 | ✅ "Убрать" bosilgach mashina, uning nuqtalari va 3D'dagi qutisi yo'qoldi. Xulosa yana 4 va 7 nuqta |
| 2.5 | tekshirilmadi: "Hammom namunasi"da oshxona yo'q |
| 2.6 | ✅ «СТИРАЛЬНАЯ МАШИНА», «Добавить стиральную машину» |
| 3.1 | ✅ "Washing machine valve" (1 pc × 60 000), "Washing machine trap" (1 pc × 70 000), "Work: connecting the washing machine" (150 000). Mashinaning o'zi narxlanmagan. Plumbing 31 → 34 qator, jami +632 190 so'm ([rasm](img/2026-11-14-kir-yuvish-santexnika/08-estimate-machine-work.jpg)) |
| 3.2 | ✅ "Wall outlet Ø20": 7 → 8 dona. "Work: connecting a point": 11 → 13 nuqta |
| 3.3 | ✅ «Кран для стиральной машины», «Сифон для стиральной машины», «Работа: подключение стиральной машины» ([rasm](img/2026-11-14-kir-yuvish-santexnika/11-estimate-ru-work.jpg)) |
| 4.1 | ✅ "Shower with no tray (floor drain)" belgisi bor va o'chiq ([rasm](img/2026-11-14-kir-yuvish-santexnika/00-panel-flags-default.jpg)). Dushsiz xonada tekshirilmadi |
| 4.2 | ✅ "Shower tray trap" yo'qoldi. O'rnida "Floor drain" (450 000) va "Work: fitting the floor drain" (200 000) chiqdi. "Shower mixer" joyida ([rasm](img/2026-11-14-kir-yuvish-santexnika/09-estimate-flags-a.jpg)) |
| 4.3 | ✅ O'chirilgach avvalgi holat qaytdi, jami summa boshlang'ich summaga teng (5.3) |
| 4.4 | ✅ «Трап», «Работа: установка трапа», «Душ без поддона (трап)» ([rasm](img/2026-11-14-kir-yuvish-santexnika/13-panel-ru-restored.jpg)) |
| 5.1 | tekshirilmadi: PDF faqat mashinasiz holatda olindi, #259 natijasiga qarang |
| 5.2 | tekshirilmadi |
| 5.3 | ✅ Boshida 21 987 530, oxirida 21 987 530 so'm |

## Web nima qilishi mumkin

1. **Surishda to'qnashuv** (1.3, 1.4): mashinani surganda boshqa buyumlar va dush kabinasi hisobga olinmayapti. Qo'yishda bu tekshiriladi, chunki qo'shganda bo'sh joy topiladi. Surishda ham shu tekshiruvni qo'llash yoki to'qnashuvdan oldin to'xtatish kerak.
