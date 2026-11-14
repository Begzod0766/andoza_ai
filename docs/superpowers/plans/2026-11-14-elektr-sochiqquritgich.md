# Elektr sochiqquritgich Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A towel rail can be electric: no water points, its own estimate lines.
**Spec:** docs/superpowers/specs/2026-11-14-elektr-sochiqquritgich-design.md

## Global Constraints
- `kind` absent = water; only exactly `'electric'` is electric.
- Norms: el rail 900 000, IP44 socket 70 000, cable 3 m, work 150 000.

## Review Focus
- An old room's rails (no kind) price and draw exactly as before.
- A room with one water and one electric rail: two hot points, both line sets.
- Switching a rail to electric removes its points from the pipe scheme in the panel's summary.

### Task 1: Backend — points and estimate
Files: `backend/app/services/towel_rail.py`, `smeta.py`, `bathroom_extras_norms.json`, `smeta_keys.py`, `estimate_catalog.py`, `smeta_text.py`, tests `test_smeta_electric_rail.py`, `test_towel_rail.py`, fixture `towelRailPoints.json` (+ case). RED → GREEN → full pytest.

### Task 2: Frontend — data, store, panel, 3D, text
Files: `store/types.ts`, `lib/towelRail.ts` (+test), `store/slices/towelRailSlice.ts` (+test: `setTowelRailKind`), `SantexnikaSection.tsx` (+test), `TowelRails3D.tsx`, i18n, `smetaLineText.ts` (+test), `adminMaterials.ts`. RED → GREEN → full vitest + tsc; QA doc; PR.
