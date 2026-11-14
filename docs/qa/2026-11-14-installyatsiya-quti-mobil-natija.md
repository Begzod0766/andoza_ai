# Installyatsiya gipsokarton qutisi: mobil tekshiruv natijasi (2026-11-14)

Ro'yxat: [2026-11-14-installyatsiya-quti-mobil-tekshiruv.md](2026-11-14-installyatsiya-quti-mobil-tekshiruv.md) (issue #268).

**Muhit:**
- Qurilma: iOS Simulator, iPhone 17 Pro.
- Ilova: andoza_ai_mobile 1.0.2+35, debug build.
- Server: production `andozaai.uz`, master `fe21aaf8`.
- Xona: "Hammom namunasi" → "Hammom". Unda oddiy "Unitaz" bor.
- Til: Русский.

## Qisqacha

| | Soni | Bandlar |
|---|---|---|
| ✅ | 1 | 2 |
| tekshirib bo'lmadi | 3 | 1, 3: katalogda osma unitaz yo'q; 5: admin hisobi bilan kirilmadi |
| kod bo'yicha | 1 | 4 |

**Asosiysi:** prod katalogida nomida "osma", "подвес", "wall-hung" yoki "installyatsiya" so'zi bor unitaz **yo'q**. Ochiq `/api/v1/furniture` qidiruvi bo'yicha hammom uchun bitta "Unitaz" bor, u oddiy unitaz. Shuning uchun asosiy bandlarni ilovada tekshirib bo'lmaydi. Buning uchun admin katalogga osma unitaz qo'shishi kerak.

## Natijalar

| # | Natija |
|---|---|
| 1 | tekshirib bo'lmadi: katalogda osma unitaz yo'q |
| 2 | ✅ Oddiy "Unitaz" turgan hammom smetasida "Влагостойкий гипсокартон (короб)", "Профиль короба (каркас)" va "Работа: сборка короба из гипсокартона" qatorlari yo'q. Unitaz uchun faqat "Гофра для унитаза", "Гибкая подводка" va "Работа: установка унитаза" bor (#277 va #266 tekshiruvlaridagi smetalar) |
| 3 | tekshirib bo'lmadi: katalogda osma unitaz yo'q |
| 4 | Kod bo'yicha: uchala qatorning o'zbekcha, ruscha va inglizcha nomlari `smeta_locale.json` da bor ("Влагостойкий гипсокартон (короб)", "Профиль короба (каркас)", "Работа: сборка короба из гипсокартона"). Ilovada ko'rilmadi |
| 5 | tekshirilmadi: admin hisobi bilan kirilmadi |
