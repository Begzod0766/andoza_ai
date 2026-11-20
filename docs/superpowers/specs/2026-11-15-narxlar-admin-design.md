# Prices in the admin panel (the three norm files) — design

Date: 2026-11-15. Scope picked by the owner: only `plumbing_norms.json`, `tile_norms.json`,
`bathroom_extras_norms.json`. Approach 1 approved ("ha, 1-yo'l ma'qul, o'zing bajar").

## Why
Every estimated price added this month lives in these files; only a code change and a deploy can
correct one. The owner wants to correct them from the admin panel.

## Approaches (picked: 1)
1. **Overrides in the database over the files (chosen):** the files stay the defaults; an admin's
   value is kept in a table and laid over them. A deploy cannot wipe it; each value can go back to
   its default; a norm added to a file later shows up by itself.
2. Edit the files on the server: the deploy's `git reset --hard` wipes every edit.
3. Move the norms into the database: the defaults leave the code; every new norm needs a migration.

## Design
**Data.** `norm_overrides` (file, path, value numeric, updated_by, updated_at; unique file+path) and
`norm_override_log` (file, path, old, new — null for "back to default" —, user, at). `file` is
`plumbing` | `tile` | `bathroom_extras`; `path` the dotted key (`part_uzs.trap_pol`).

**Engine.** `load_plumbing_norms()`, `load_tile_norms()`, `load_bathroom_extras_norms()` return the
file laid over with the overrides (`app.services.norm_overrides`). Each process keeps the overrides
in memory and re-reads them at most every 30 s, when an estimate's norms are loaded
(`_load_norms` in the estimate, AI and room-state routers); a save also updates its own process at
once. So a change reaches every estimate within a minute. A path no longer in its file is ignored.

**Catalog.** `app.services.norm_catalog`: each number's Uzbek name, unit and group. A test checks
every number in the three files is in it (or listed as unused: `towel_rail_uzs`,
`el_towel_rail_uzs`, `fan_uzs`, superseded by the by-size prices), so a new norm cannot be added
without its name.

**API** (admin only): `GET /admin/norms` (every entry: file, path, group, label, unit, default,
value, overridden, updated_at), `PUT /admin/norms/{file}/{path}` `{value}`, `DELETE` the same (back
to default), `GET /admin/norms/log`. A value must be a finite number > 0 and ≤ 100 000 000;
a so'm price is a whole number. An unknown file or path is 404.

**Panel.** A "Narxlar" tab in the Do'kon admin: a search box, the entries by group with name, unit,
value (editable, saved on Enter / leaving the field), "asl: …" and a dot when changed, and
"Asl holiga"; below, the last 50 changes. Labels come from the server (Uzbek); the tab's own words
in uz/ru/en.

## Anti-goals
- With no overrides every estimate prices exactly as today.
- Nothing else in the admin panel changes; no non-admin can read or change a norm.
