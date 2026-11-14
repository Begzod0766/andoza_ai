# Suv kirish uzeli Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Santexnika switch that adds the water inlet unit (meter, filter, reducer, check valve, work) to the estimate per incoming line.

**Architecture:** Backend `_plumbing_lines` reads `designState.waterInlet` and appends `_water_inlet_lines(...)`; norms in `plumbing_norms.json`; four new piece keys; frontend switch, type, i18n, and the label mirror.

**Tech Stack:** FastAPI/pytest backend, React/vitest frontend, i18next.

**Spec:** docs/superpowers/specs/2026-11-14-suv-kirish-uzeli-design.md

## Global Constraints
- Off unless `designState.waterInlet` is exactly `true`.
- Norms: hisoblagich_suv 180 000, filtr_suv 60 000, reduktor 250 000, klapan_teskari 40 000 (in `part_uzs`); `work_water_inlet_uzs` 200 000.
- Labels exactly: "Suv hisoblagichi", "Dag'al filtr", "Bosim reduktori", "Teskari klapan", "Ish: suv kirish uzelini yig'ish".
- Keys listed literally in `KEY_PACK_UNIT` (admin sync test parses that block).

## Review Focus
- Switch on in a room with no plumbing points at all → still 1 line (cold), like the heater.
- Hot point present + `waterHeater: true` → 1 line, not 2.
- `waterInlet: "yes"` / `false` / missing → nothing added.
- A tagged shop product sold by the metre (wrong unit) → norm used, approximate.
- Russian/English text for every new label, a shop name after ":" kept.

---

### Task 1: Backend estimate lines

**Files:** Modify `backend/app/services/smeta.py`, `backend/app/data/plumbing_norms.json`, `backend/app/services/smeta_keys.py`, `backend/app/services/estimate_catalog.py`, `backend/app/services/smeta_text.py`, `backend/tests/test_estimate_catalog.py`; Create `backend/tests/test_smeta_water_inlet.py`.

**Interfaces:** Produces `_water_inlet_lines(inlets: int, catalog: dict, norms: dict) -> list[ComputedLine]`.

- [ ] Step 1: tests in `test_smeta_water_inlet.py`: off for None/{}/False/"yes"; on with a sink (cold+hot points) → each part qty 2, formula starts `2 liniya = 2 dona × …`, work qty 2 × 200 000; with `waterHeater: true` → qty 1, `1 liniya = 1 dona × …`; no fixtures → qty 1; tagged shop `reduktor` (dona) gives its price, not approximate; a metre-sold product falls back to the norm; keys in `ALL_SMETA_KEYS` with sale unit `dona`; every label localizes in ru and en.
- [ ] Step 2: run, see FAIL.
- [ ] Step 3: implement; add keys; label maps in `smeta_text.py`; regenerate `smeta_locale.json` after Task 2's i18n.
- [ ] Step 4: run, PASS; full backend suite.

### Task 2: Frontend switch and text

**Files:** Modify `frontend/src/store/types.ts`, `SantexnikaSection.tsx` (+test), `frontend/src/i18n/locales/{uz,ru,en}.json`, `frontend/src/lib/smetaLineText.ts` (+test), `frontend/src/lib/api/adminMaterials.ts`.

- [ ] Step 1: tests: the switch "Suv kirish uzeli (hisoblagich, filtr, reduktor)" is unchecked, a click sets `designState.waterInlet` true; `localizeLabel` reads the five labels in ru/en and keeps a shop name.
- [ ] Step 2: run, FAIL.
- [ ] Step 3: implement; `SMETA_KEYS` gets the four keys (`packUnit: null, unit: "dona"`).
- [ ] Step 4: run, PASS; full vitest + `tsc -b`; regenerate `smeta_locale.json`; backend suite again.
- [ ] Step 5: QA checklist `docs/qa/2026-11-14-suv-kirish-uzeli-mobil-tekshiruv.md`; commit; PR.
