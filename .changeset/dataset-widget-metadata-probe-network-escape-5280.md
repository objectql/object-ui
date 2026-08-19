---
---

Test-only (objectui#5280). `DatasetWidget.test.tsx`'s dimension-metadata probe —
`useDatasetDimensionMeta`'s `apiFetch ?? fetch` fallback, exercised whenever a mocked
`queryDataset` result carries `object` — escaped to the real network: 5 live TCP connection
attempts per run against `http://localhost:3000` (happy-dom's default document URL), all
best-effort-swallowed so the suite stayed green throughout. Same root cause and same fix
shape as objectui#5225's reference PR (#5283, `plugin-report`'s `DatasetReportRenderer.test.tsx`):
a recording double answers the metadata route with an option-free payload — byte-identical
to what the failed read produced, so no pre-existing assertion changes meaning — records
every URL, and `afterEach` fails on any non-metadata escape instead of swallowing it. Three
new tests pin the probe's own request shape (object, count, route) and its previously
unexercised success path. All 52 pre-existing tests still pass; none depended on the
swallowed failure. No published behaviour changes.
