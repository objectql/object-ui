---
---

Test-only (objectui#5299). `DashboardGridLayout.datasetPath.test.tsx`'s
'options.data provider widget' negative-control test escaped to the real network:
1 live TCP connection attempt per run against `http://localhost:3000` (happy-dom's
default document URL), best-effort-swallowed so all 13 pre-existing tests stayed
green throughout. `-t` bisected across all 13 cases in isolation to pin the exact
site — the only escape in the file — refuting the `isLegacyRetiredWidget` sentinel
candidate a previous round suspected (neither of its two tests escapes alone).

Root cause: the `options.data.provider: 'object'` widget maps to component type
`object-chart`, whose `ObjectChart.tsx` (`@object-ui/plugin-charts`) still carries
its own inline `apiFetch ?? fetch` category-color probe — the original objectui#4106
defect site, never migrated onto the `useDatasetDimensionMeta` hook objectui#4389
extracted for the dataset-bound path. Same fix shape as objectui#5225's reference PR
(#5283) and objectui#5280's port (#5300): a recording double answers the metadata
route, `afterEach` fails on any non-metadata escape instead of swallowing it, and
`cleanup()` runs before `vi.unstubAllGlobals()` in the same `afterEach` to avoid the
reverse-registration flake #5280 measured. One new test pins the probe's own request
shape (exactly one call to `/api/v1/meta/object/invoices`). All 13 pre-existing tests
still pass; none depended on the swallowed failure. No published behaviour changes.
