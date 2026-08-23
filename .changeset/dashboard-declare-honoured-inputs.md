---
'@object-ui/plugin-dashboard': minor
---

`dashboard` now publishes the authoring inputs its renderer already honours — `widgets`, `label`, `description`, `header`, `globalFilters`, `dateRange`, `refreshInterval` — so `validateTree`, the generated `sdui.manifest.json` and `sdui-intrinsics.d.ts` stop warning authors off keys that work (previously only `columns`/`gap`/`className` were published, and every other honoured key drew `unknown-prop`). Each declared key is accepted by the spec's strict `DashboardSchema`, so the manifest never offers a key the save gate refuses. The legacy `title` spelling and the retired `aria` key stay deliberately unpublished and are pinned as such; the `schema.title || schema.label` fallback read is unchanged, so documents in the wild keep rendering their header title.
