# Interaktiv Studio qo'llanmasi — bajarish rejasi

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Maqsad:** Telefondagi Studio qo'llanmasi uchta asosiy harakatni (devor yoki polga bosish, mebel qo'shish, bosqich almashtirish) foydalanuvchiga o'zi bajartirib o'rgatadi. Qolgan tugmalar strelkali spotlight bilan ko'rsatiladi.

**Arxitektura:** `StudioTour` ikki xil qadamni biladigan bo'ladi: `show` (hozirgidek, «Keyingi») va `do` (teshik bosishni nishonga o'tkazadi, holat kuzatiladi). Har bir `do` qadamda bir nechta nishon bo'ladi va spotlight ekrandagi eng chuqur nishonga turadi. Holat `roomStore`'dan (mebel id'lari, `viewStage`) va kichik voqealar modulidan (devor tanlandi / bosqichni qaytar) olinadi. Mashq mebeli `localStorage`'da kuzatiladi va tugashda (savol bilan) yoki uzilganda (so'ramasdan) o'chiriladi.

**Tech Stack:** React 18 + TypeScript, zustand (+zundo), react-i18next, Tailwind, vitest + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-11-21-interaktiv-studio-qollanmasi-design.md`

## Global Constraints

- Ish faqat `~/Projects/andoza_ai-tour` worktree'sida, `feat/interactive-studio-tour` branchida. Node `~/.local/node/bin` da (`export PATH=~/.local/node/bin:$PATH`).
- Testlar: `cd frontend && npx vitest run <fayl>`. Oxirida: `npx vitest run`, `npx tsc --noEmit`, `npm run lint` (bo'lsa).
- Faqat telefon (`compact`): kompyuterdagi Studio'ning xatti-harakati o'zgarmaydi.
- Flutter shartnomasi o'zgarmaydi: `notifyAppTour(open)` / kanal `AndozaStudioTour`, `TOUR_SKIP_EVENT = "andoza:tour-skip"`.
- Eslab qolish kaliti: `studio.tour.v2.done` (eski `studio.tour.v1.done` o'qilmaydi). Mashq yozuvi kaliti: `studio.tour.practice`.
- Har bir yangi matn `uz.json`, `ru.json`, `en.json` ga birga qo'shiladi (`studio.tour.*`).
- Mashq savoli matni (uz): «Mashqda qo'shilgan mebel qoldirilsinmi?», tugmalar «Olib tashlash» / «Qoldirish».
- Qo'llanma paytida pullik tugma bosilmaydi: `do` qadamda faqat shu qadamning joriy nishoni bosiladi.
- `prefers-reduced-motion: reduce` bo'lsa, «qo'l» qimirlamaydi.
- Qo'llanma uzilsa (ilova «Orqaga», sahifadan chiqish, ilova o'ldirilishi), mashq mebeli **so'ramasdan** o'chiriladi.

## Review Focus

1. **Mashqdan oldin qo'yilgan mebel** hech qachon o'chirilmaydi, hatto foydalanuvchi qo'llanma paytida eski mebelni surgan yoki o'lchamini o'zgartirgan bo'lsa ham. 1-vazifadagi `newFurnitureIds` testi bunga qaraydi.
2. **Foydalanuvchi mashq mebelini qo'llanma paytida o'zi o'chirib qo'yadi:** keyin tozalash xato bermaydi, yo'q id'lar o'tkazib yuboriladi, savol ham chiqmaydi. Testlar 1- va 5-vazifada.
3. **Boshqa xonaning yozuvi:** `studio.tour.practice` A xonaga tegishli, Studio esa B xonani ochdi. B xonadagi hech narsa o'chirilmaydi, yozuv o'z joyida qoladi. Test 7-vazifada.
4. **Menyu yarim yo'lda yopiladi** (Mebel → xona turi, keyin fon bosildi): spotlight shu qadamning birinchi nishoniga qaytadi, qo'llanma osilib qolmaydi. Test 4-vazifada.
5. **Ikki marta tugatish:** savol ochiq turganda ilovaning «Orqaga» tugmasi bosiladi. Mashq mebeli bir marta o'chiriladi, `onFinish` ham bir marta chaqiriladi. Test 5-vazifada.

---

### 1-vazifa: Mashq mebeli yordamchilari va bitta undo qadamida o'chirish

**Fayllar:**
- Yaratish: `frontend/src/lib/tourPractice.ts`
- O'zgartirish: `frontend/src/store/slices/furnitureSlice.ts` (interfeys + `removeFurniture` yonida)
- Test: `frontend/src/lib/__tests__/tourPractice.test.ts`, `frontend/src/store/__tests__/` dagi mavjud furniture slice testi (bo'lmasa `furnitureSlice.removeMany.test.ts` yaratiladi)

**Interfeyslar:**
- Beradi:
  - `newFurnitureIds(baseline: readonly string[], current: readonly { id: string }[]): string[]` — `current` dagi, `baseline` da bo'lmagan id'lar, `current` tartibida.
  - `type PracticeRecord = { roomId: string; ids: string[] }`
  - `savePractice(rec: PracticeRecord, storage?: Storage | null): void`. `ids` bo'sh bo'lsa, yozuvni o'chiradi.
  - `loadPractice(storage?: Storage | null): PracticeRecord | null`. Buzilgan JSON → `null`.
  - `clearPractice(storage?: Storage | null): void`
  - `PRACTICE_KEY = "studio.tour.practice"`
  - Slice: `removeFurnitureMany(ids: readonly string[]): void` — bitta `set()` bilan; yo'q id'lar e'tiborsiz; `ids` bo'sh bo'lsa yoki hech biri topilmasa, `set` chaqirilmaydi.
- Storage xatolari (throw) yutiladi, xuddi `lib/studioTour.ts` dagi `defaultStorage()` kabi.

- [ ] **1-qadam: muvaffaqiyatsiz testlarni yozish**
  - `newFurnitureIds(['a','b'], [{id:'a'},{id:'c'},{id:'b'},{id:'d'}])` → `['c','d']`
  - `newFurnitureIds(['a'], [])` → `[]`
  - `savePractice({roomId:'r1', ids:['c']})` → `loadPractice()` → `{roomId:'r1', ids:['c']}`
  - `savePractice({roomId:'r1', ids:[]})` → `loadPractice()` → `null`
  - `localStorage.setItem(PRACTICE_KEY, '{bad')` → `loadPractice()` → `null`
  - throw qiladigan storage bilan `savePractice` / `loadPractice` / `clearPractice` throw qilmaydi
  - store: furniture `[a,b,c]` → `removeFurnitureMany(['c','x'])` → `[a,b]`; `useRoomStore.temporal.getState().pastStates.length` faqat 1 ga oshadi
  - store: `removeFurnitureMany(['x'])` → furniture va `pastStates` o'zgarmaydi
- [ ] **2-qadam:** `npx vitest run src/lib/__tests__/tourPractice.test.ts` → FAIL (modul yo'q)
- [ ] **3-qadam:** `tourPractice.ts` va `removeFurnitureMany` ni yozish (`removeFurniture` kabi `isDirty: true` va `withFixturePoints` bilan)
- [ ] **4-qadam:** testlar → PASS
- [ ] **5-qadam:** commit `feat(studio): mashq mebelini kuzatish yordamchilari`

### 2-vazifa: Qadamlar modeli va voqealar

**Fayllar:**
- O'zgartirish: `frontend/src/lib/studioTour.ts`
- Yaratish: `frontend/src/lib/studioTourEvents.ts`
- Test: `frontend/src/lib/__tests__/studioTour.test.ts` (mavjud bo'lsa yangilanadi), `frontend/src/lib/__tests__/studioTourEvents.test.ts`

**Interfeyslar:**
- Beradi (`studioTour.ts`):
  - `type StudioTourStepId = "surface" | "furniture" | "stage" | "menu" | "undo" | "lock" | "camera" | "help"`
  - `type StudioTourStep = { id: StudioTourStepId; kind: "do" | "show"; targets: readonly string[] }`. `targets` — `data-tour` qiymatlari, sayozdan chuqurga.
  - `STUDIO_TOUR_STEPS: readonly StudioTourStep[]`:
    - `surface` / `do` / `["scene"]`
    - `furniture` / `do` / `["arc-mebel", "arc-mebel-ring-0", "arc-mebel-ring-1"]`
    - `stage` / `do` / `["stage", "stage-list"]`
    - `menu` / `show` / `["menu"]`
    - `undo` / `show` / `["undo"]`
    - `lock` / `show` / `["lock"]`
    - `camera` / `show` / `["camera"]`
    - `help` / `show` / `["help"]`
  - `STUDIO_TOUR_KEY = "studio.tour.v2.done"`
  - `presentSteps(steps: readonly StudioTourStep[], isPresent: (target: string) => boolean): StudioTourStep[]` — birinchi nishoni ekranda bo'lgan qadamlar.
  - `StudioTourTarget` turi olib tashlanadi; uni ishlatgan joylar `string` (target) yoki `StudioTourStepId` ga o'tadi.
  - `isStudioTourDone`, `markStudioTourDone`, `shouldStartStudioTour`, `TOUR_SKIP_EVENT`, `notifyAppTour` o'zgarmaydi.
- Beradi (`studioTourEvents.ts`):
  - `type StudioTourEvent = "surface-picked" | "restore-view"`
  - `emitTourEvent(e: StudioTourEvent): void`
  - `onTourEvent(e: StudioTourEvent, cb: () => void): () => void` (obunani bekor qiluvchi qaytaradi). `EventTarget` asosida, `window` ga bog'lanmagan modul ichidagi bitta instance.

- [ ] **1-qadam: testlar**
  - `STUDIO_TOUR_STEPS.map(s => s.id)` → spec'dagi 8 ta tartib
  - `STUDIO_TOUR_KEY === "studio.tour.v2.done"`; v1 kaliti qo'yilgan storage'da `isStudioTourDone()` → `false`
  - `presentSteps(STUDIO_TOUR_STEPS, t => t !== "arc-mebel")` → `furniture` yo'q
  - `onTourEvent("surface-picked", cb)`; `emitTourEvent("surface-picked")` → cb 1 marta; unsubscribe'dan keyin → 0 marta; `restore-view` → `surface-picked` cb chaqirilmaydi
- [ ] **2-qadam:** FAIL ni ko'rish
- [ ] **3-qadam:** kodni yozish; `tsc --noEmit` dagi `StudioTourTarget` xatolarini faqat tur darajasida tuzatish (xatti-harakat 4-vazifada)
- [ ] **4-qadam:** PASS
- [ ] **5-qadam:** commit `feat(studio): qo'llanma qadamlari do/show modeli`

### 3-vazifa: «Qo'l» animatsiyasi

**Fayllar:**
- Yaratish: `frontend/src/components/studio/TourHand.tsx`
- O'zgartirish: `frontend/src/index.css` (yoki Tailwind keyframes turgan fayl: `arcfade` qayerda bo'lsa, o'sha yerga) — `@keyframes tourtap`
- Test: `frontend/src/components/studio/TourHand.test.tsx`

**Interfeyslar:**
- Beradi: `TourHand({ x, y, replayKey }: { x: number; y: number; replayKey: number }): JSX.Element`. Ko'rsatkich barmog'i uchi `(x, y)` ekran nuqtasida turadi (`position: fixed`, `pointer-events: none`, `aria-hidden`). `replayKey` o'zgarsa, animatsiya qaytadan boshlanadi (`key` orqali). Animatsiya: tushadi → bosadi → to'lqin halqa, ~1,2 s, 2 marta. Ichki SVG, tashqi kutubxonasiz.
- `motion-reduce:` Tailwind variant bilan animatsiya o'chadi.

- [ ] **1-qadam: testlar:** `left`/`top` `x`/`y` dan; `aria-hidden="true"`; `pointer-events: none` klassi; `replayKey` o'zgarganda element yangi DOM tuguni bo'ladi
- [ ] **2-qadam:** FAIL
- [ ] **3-qadam:** komponent + keyframes
- [ ] **4-qadam:** PASS
- [ ] **5-qadam:** commit `feat(studio): qo'llanma uchun qo'l animatsiyasi`

### 4-vazifa: StudioTour — `do` qadamlari

**Fayllar:**
- O'zgartirish: `frontend/src/components/studio/StudioTour.tsx`
- Test: `frontend/src/components/studio/StudioTour.test.tsx` (mavjud testlar yangi modelga ko'chiriladi)

**Interfeyslar:**
- Iste'mol qiladi: 2-vazifadagi `StudioTourStep`, `onTourEvent("surface-picked")`; 3-vazifadagi `TourHand`; `useRoomStore` (`furniture`, `viewStage`); 1-vazifadagi `newFurnitureIds`, `savePractice`.
- Beradi: `StudioTour({ steps, roomId, onStepChange, onFinish })`
  - `steps: readonly StudioTourStep[]`
  - `roomId: string`
  - `onStepChange?: (id: StudioTourStepId | null) => void` — har qadam o'zgarganda; tugaganda `null`
  - `onFinish: (reason: "done" | "skip" | "app" | "unmount") => void` — bir marta.
- Xatti-harakat:
  - Ochilganda baseline: `furniture` id'lari va `viewStage`.
  - **Joriy nishon:** `show` qadamda `targets[0]`; `do` qadamda `targets` ichida ekranda turgan eng oxirgisi (hech biri bo'lmasa `targets[0]`). `do` qadamda o'lchash har `requestAnimationFrame` da qayta qilinadi (menyu ochilib-yopilishini kuzatish uchun), `show` da hozirgidek resize/orientationchange'da.
  - **Teshik:** `show` da hozirgidek «Keyingi» tugmasi; `do` da teshik joyida element yo'q (bosish nishonning o'ziga tushadi), 4 ta qoraytirilgan bo'lak qolgan hamma narsani bloklaydi.
  - **Karta:** `do` da bir qator: `step_of`, `studio.tour.<id>.body`, «O'tkazib yuborish»; «Keyingi» yo'q. `show` da hozirgidek, sarlavhasiz bir qator matn + strelka (karta bilan nishon orasida, CSS uchburchak).
  - **Bajarildi:** `surface` — `surface-picked` voqeasi; `furniture` — `newFurnitureIds(baseline, furniture).length > 0`; `stage` — `viewStage !== baselineViewStage`. Bajarilgach 600 ms ✓ (`data-tour-check`), keyin keyingi qadam.
  - Har o'zgarishda `savePractice({ roomId, ids: newFurnitureIds(...) })`.
  - **«Qo'l»:** `do` qadamda joriy nishon markazida; 10 000 ms harakatsizlikdan keyin `replayKey` +1 (har qadam/nishon almashganda taymer qaytadan).
  - Qadam o'zgarganda `onStepChange`.

- [ ] **1-qadam: testlar** (mavjud `rects` mock'i bilan; `useRoomStore.setState` bilan holat)
  - `do_surface_hole_passes_click`: `scene` qadamida teshik tugmasi yo'q; `document.elementFromPoint` o'rniga: `[data-tour-hole]` yo'qligi va `[data-tour-backdrop]` 4 ta
  - `surface_completes_on_event`: `act(() => emitTourEvent("surface-picked"))` → `[data-tour-check]` ko'rinadi; `vi.advanceTimersByTime(600)` → `onStepChange("furniture")`
  - `furniture_deepest_target`: `arc-mebel` va `arc-mebel-ring-0` ikkalasi bor → spotlight `ring-0` o'lchamida; `ring-0` olib tashlanadi, keyingi kadr → `arc-mebel` ga qaytadi (Review Focus 4)
  - `furniture_completes_on_new_id`: baseline `[a]`; `setState({ furniture: [a, b] })` → ✓; eski `a` ni surish (`furniture: [{...a, x: 9}]`) ✓ bermaydi
  - `practice_saved`: yangi `b` dan keyin `loadPractice()` → `{ roomId, ids: ['b'] }`
  - `stage_completes_on_change`: baseline `full`; `setState({ viewStage: 'suvoq' })` → ✓
  - `hand_replays_after_idle`: fake timers, 10 000 ms → `TourHand` qayta mount bo'ladi
  - `show_step_keeps_next`: `menu` qadamida «Keyingi» bor va teshik bosilsa keyingi qadamga o'tadi (mavjud test)
  - mavjud testlar (vanish, rotation, StrictMode, double skip, app bridge) yangi `steps` shakli bilan o'tadi
- [ ] **2-qadam:** FAIL
- [ ] **3-qadam:** komponentni yozish
- [ ] **4-qadam:** PASS
- [ ] **5-qadam:** commit `feat(studio): qo'llanmada foydalanuvchi qadamni o'zi bajaradi`

### 5-vazifa: StudioTour — tugash, savol va so'ramasdan tozalash

**Fayllar:**
- O'zgartirish: `frontend/src/components/studio/StudioTour.tsx`
- Test: `frontend/src/components/studio/StudioTour.test.tsx`

**Interfeyslar:**
- Iste'mol qiladi: `emitTourEvent("restore-view")`, `removeFurnitureMany`, `loadPractice`, `clearPractice`.
- Xatti-harakat:
  - **«Tushunarli» yoki «O'tkazib yuborish»:** avval `emitTourEvent("restore-view")`. Keyin mashq id'larining hozir `furniture` da bori olinadi. Bo'sh bo'lsa → `clearPractice()`, `onFinish("done" | "skip")`. Bo'lmasa → savol oynasi (`role="alertdialog"`): «Olib tashlash» → `removeFurnitureMany(ids)`; «Qoldirish» → hech narsa. Ikkalasida ham keyin `clearPractice()` va `onFinish`. Savol paytida spotlight va qoraytirish yo'q, faqat oyna.
  - **`TOUR_SKIP_EVENT` (ilova «Orqaga»)**, savol ochiq bo'lsa ham: `restore-view`, `removeFurnitureMany(ids)`, `clearPractice()`, `onFinish("app")`.
  - **Unmount** (`finish` hali chaqirilmagan bo'lsa): `restore-view`, `removeFurnitureMany(ids)`, `clearPractice()`, `onFinish("unmount")`.
  - **Nishonlar yo'qolib tugasa** (masalan, 3D'dan smetaga o'tildi): unmount kabi, so'ramasdan tozalanadi, `onFinish("unmount")`.
  - **`roomId` prop o'zgarsa** (boshqa xonaga o'tildi): store endi yangi xonaniki, shuning uchun hech narsa o'chirilmaydi. Yozuv `localStorage` da qoladi, `onFinish("unmount")`. Eski xona keyingi ochilganda 7-vazifa uni tozalaydi.
  - Hammasida `finishedRef` bitta marta ishlashini kafolatlaydi, `notifyAppTour(false)` hozirgidek.

- [ ] **1-qadam: testlar**
  - `done_without_practice_no_question`: mashq yo'q, «Tushunarli» → `alertdialog` yo'q, `onFinish('done')`
  - `restore_before_question`: `onTourEvent('restore-view', spy)`; mashq `b` bor → «Tushunarli» → spy chaqirilgan, so'ng `alertdialog` ko'rinadi
  - `remove_answer`: «Olib tashlash» → `furniture` ichida `b` yo'q, `a` bor; `loadPractice()` → `null`
  - `keep_answer`: «Qoldirish» → `b` qoladi; `loadPractice()` → `null`
  - `user_deleted_practice_itself`: `b` qo'shildi, keyin `b` o'chirildi → «Tushunarli» → savol yo'q (Review Focus 2)
  - `app_back_removes_silently`: `b` bor, `TOUR_SKIP_EVENT` → savol yo'q, `b` yo'q, `onFinish('app')`
  - `app_back_during_question_once`: savol ochiq → `TOUR_SKIP_EVENT` ikki marta → `onFinish` 1 marta, `removeFurnitureMany` 1 marta (Review Focus 5)
  - `unmount_removes_silently`: `b` bor → `unmount()` → `b` yo'q, `onFinish('unmount')`
  - `targets_vanish_removes_silently`: `b` bor, hamma nishonlar olib tashlanadi → `b` yo'q, `onFinish('unmount')`
  - `room_change_keeps_record`: `b` bor, `rerender` `roomId: 'r2'` → `removeFurnitureMany` chaqirilmagan, `loadPractice()` → `{ roomId: 'r1', ids: ['b'] }`
- [ ] **2-qadam:** FAIL
- [ ] **3-qadam:** kodni yozish
- [ ] **4-qadam:** PASS
- [ ] **5-qadam:** commit `feat(studio): qo'llanma oxirida mashq mebeli haqida so'raydi`

### 6-vazifa: Yangi nishonlar (yoy va bosqichlar)

**Fayllar:**
- O'zgartirish: `frontend/src/components/studio/QuarterArcMenu.tsx`, `frontend/src/features/studio/useArcCategories.tsx`, `frontend/src/components/studio/MobileStagePicker.tsx`
- Test: `QuarterArcMenu.compact.test.tsx` (yoki yangi `QuarterArcMenu.tour.test.tsx`), `MobileStagePicker.test.tsx`, `useArcCategories` testi bo'lsa o'sha

**Interfeyslar:**
- `ArcCategory` ga `tourKey?: string` qo'shiladi.
- `QuarterArcMenu`: `tourKey` li kategoriya tugmasida `data-tour={`arc-${tourKey}`}`. Menyu shu kategoriyada ochiq bo'lsa, ko'rinmas footprint `<div data-tour={`arc-${tourKey}-ring-${trail.length}`}>`, ochiq tashqi halqani qamraydi: o'lcham `ANCHOR / 2 + ARC_RADIUS_OUTER + ARC_ITEM_OUTER / 2`, mavjud `arc` footprint kabi `right: 0; bottom: 0`.
- `useArcCategories`: Mebel kategoriyasiga `tourKey: "mebel"` faqat kamida bitta xona turida (`room:*`, yuklanganlar bilan) ≥1 mebel bo'lsa qo'yiladi (spec: katalog bo'sh bo'lsa, 2-qadam tashlanadi).
- `MobileStagePicker`: pill tugmasida `data-tour="stage"`, ochiq ro'yxatda `data-tour="stage-list"`.

- [ ] **1-qadam: testlar**
  - yopiq menyu, `tourKey: 'mebel'` → `[data-tour="arc-mebel"]` bor, `ring-0` yo'q
  - Mebel bosildi → `[data-tour="arc-mebel-ring-0"]` bor; xona turi bosildi → `ring-1` bor, `ring-0` yo'q
  - `tourKey` siz kategoriya → `arc-*` nishoni yo'q
  - `useArcCategories`: hamma `modelsForRoom` bo'sh → mebel `tourKey` `undefined`; bitta model → `'mebel'`
  - `MobileStagePicker`: `[data-tour="stage"]` doim; ochilganda `[data-tour="stage-list"]`
- [ ] **2-qadam:** FAIL
- [ ] **3-qadam:** kodni yozish
- [ ] **4-qadam:** PASS
- [ ] **5-qadam:** commit `feat(studio): qo'llanma uchun yoy va bosqich nishonlari`

### 7-vazifa: StudioPage va ThreeDPage ulanishi

**Fayllar:**
- O'zgartirish: `frontend/src/pages/studio/StudioPage.tsx`, `frontend/src/pages/studio/ThreeDPage.tsx`, `frontend/src/pages/studio/three-d/useStudioTourWiring.ts`
- Test: `frontend/src/pages/studio/__tests__/studioTourWiring.test.tsx`

**Interfeyslar:**
- Iste'mol qiladi: 4–5-vazifadagi `StudioTour` props'lari, `emitTourEvent` / `onTourEvent`, `loadPractice`, `clearPractice`, `removeFurnitureMany`.
- `StudioPage`:
  - `tourSteps: StudioTourStep[] | null`; `openTour` `presentSteps(STUDIO_TOUR_STEPS, isTourTargetShown)` bilan.
  - `const [tourStep, setTourStep] = useState<StudioTourStepId | null>(null)`; `<StudioTour roomId={roomId} onStepChange={setTourStep} onFinish={finishTour} />`.
  - Outlet context'ga `studioTourStep: tourStep` qo'shiladi.
  - `finishTour(reason)` — hamma sabablarda `markStudioTourDone()` (hozirgidek).
- `ThreeDPage`:
  - `focusSurface` ichida, `studioTourActive` bo'lsa: `emitTourEvent("surface-picked")`, keyin `closeRadial()` (✓ chiqqanda menyu yopiladi, spec: bo'yoq qo'yilmaydi).
  - `studioTourStep === "surface"` bo'lsa, sahna ustidagi suzuvchi tugmalar render qilinmaydi: `CameraBar` / kamera ro'yxati, qulf, `QuarterArcMenu`, `MobileStagePicker` pill. Bosiladigani faqat kanvas qoladi.
  - `QuarterArcMenu closed={studioTourActive && studioTourStep !== "furniture"}`.
  - `useStudioTourWiring`: `onStart` da `{ viewStage, activePhase }` snapshot (ref'ga); `onTourEvent("restore-view", ...)` va `onEnd` da `setViewStage(snap.viewStage)`, `setActivePhase(snap.activePhase)`, so'ng ref `null` (takror chaqiruv hech narsa qilmaydi).
  - `roomReady` `true` bo'lganda bir marta: `loadPractice()` → `roomId === room.id` bo'lsa → `removeFurnitureMany(ids)` + `clearPractice()`. Boshqa xona bo'lsa, tegmaydi (Review Focus 3). Qo'llanma ochiq bo'lsa, bu ishlamaydi.

- [ ] **1-qadam: testlar** (mavjud `studioTourWiring.test.tsx` uslubida)
  - `surface_step_hides_floating_buttons`: `studioTourStep: 'surface'` → `[data-tour="lock"]`, `[data-tour="camera"]`, `[data-tour="arc"]`, `[data-tour="stage"]` yo'q; `[data-tour="scene"]` bor
  - `surface_pick_emits_and_closes_radial`: tur faol, devor tanlandi → `surface-picked` voqeasi; radial menyu yopiq
  - `arc_open_only_on_furniture_step`: `furniture` → `closed` false; `menu` → true
  - `restore_view`: tur boshlandi (`viewStage: full`, phase `boyoq`), keyin `pickStage('suvoq')`, `emitTourEvent('restore-view')` → `viewStage === 'full'`, faol phase `boyoq`
  - `pending_practice_same_room`: `savePractice({ roomId: room.id, ids: ['b'] })`, furniture `[a, b]` → `roomReady` → `[a]`, `loadPractice()` → `null`
  - `pending_practice_other_room`: `roomId: 'other'` → furniture o'zgarmaydi, yozuv qoladi
- [ ] **2-qadam:** FAIL
- [ ] **3-qadam:** kodni yozish
- [ ] **4-qadam:** PASS
- [ ] **5-qadam:** commit `feat(studio): interaktiv qo'llanmani Studio'ga ulash`

### 8-vazifa: Matnlar, to'liq tekshiruv va hujjat

**Fayllar:**
- O'zgartirish: `frontend/src/i18n/locales/uz.json`, `ru.json`, `en.json` (`studio.tour`); yangi kalit ishlatilmasa, eski `title`lar olib tashlanadi
- Test: mavjud locale paritet testi (`studioLanguage.test.tsx` yoki i18n testi) o'tishi

**Matnlar (uz, `body`):**
- `surface`: «Devor yoki polga bosing»
- `furniture`: «Mebel qo'shing: Mebel → xona → buyum»
- `stage`: «Bosqichni almashtiring»
- `menu`: «Smeta va PDF shu yerda»
- `undo`: «Oxirgi amalni bekor qilish»
- `lock`: «Kamerani qotirish»
- `camera`: «Tayyor kameralar va render»
- `help`: «Qo'llanmani istalgan payt qayta ko'ring»
- `practice_question`: «Mashqda qo'shilgan mebel qoldirilsinmi?»; `practice_remove`: «Olib tashlash»; `practice_keep`: «Qoldirish»
- ru va en — shu ma'nodagi tarjimalar.

- [ ] **1-qadam:** uchta locale'ni yangilash
- [ ] **2-qadam:** `npx vitest run` → hammasi PASS
- [ ] **3-qadam:** `npx tsc --noEmit` → 0 xato; `npm run lint` (bo'lsa) → 0 xato
- [ ] **4-qadam:** brauzerda telefon o'lchamida (`npm run dev`, 390×844) qo'lda tekshirish: 8 qadam; devorga bosish → ✓; Mebel → xona → buyum → ✓; bosqich → ✓; «Tushunarli» → bosqich qaytadi, savol → «Olib tashlash» → mebel yo'q. Qayta: 2-qadamda sahifani yangilash → mashq mebeli Studio ochilganda yo'qoladi
- [ ] **5-qadam:** commit `feat(studio): interaktiv qo'llanma matnlari (uz/ru/en)`
