---
'@object-ui/plugin-report': patch
'@object-ui/app-shell': patch
---

Report and dataset-preview measures follow the display locale (objectui#4575)

objectui#4566 gave `formatMeasure` / `formatDimensionValue` in `@object-ui/core`
an optional trailing `locale` and threaded `useDisplayLocale()` through the
dashboard's `DatasetWidget`. The parameter is OPTIONAL by design, so the
producer could land without dragging every consumer with it — which left the
consumers it did not reach still formatting in the MACHINE's locale. A German
session read a report measure as `1,234.5` directly beside a dashboard measure
that, after #4566, rendered `1.234,5`: one number, two spellings, on the same
screen. That is a sharper inconsistency than the one before #4566, when both
surfaces were uniformly wrong.

The remaining thirteen call sites now thread `useDisplayLocale()`:

- `plugin-report`'s `DatasetReportRenderer` (ten) — the grouped table's measure,
  dimension and grand-total cells, the embedded single-value chart's metric, and
  the cross-tab's across-axis header, down-axis cell, measure cell, row total,
  column total and grand total;
- `app-shell`'s metadata-admin `DatasetPreview` (two) — the preview table's
  measure and dimension cells;
- `app-shell`'s `DatasetDefaultInspector` (one) — the measure format-hint
  sample, which is a preview of authored formatting and so has to be rendered
  through the channel it previews.

**English output does not move**, and that is the discriminator against the
sibling fix. These sites already went through `Intl` with default grouping, so
the only thing that changes is WHOSE locale is used — contrast objectui#4553,
where `formatPercent` had never grouped at all and moving en `1235%` to
`1,235%` WAS the fix. Every new case pins the same value in de AND in en, so
at least one half must fail on any runner: before the change both render in the
machine's locale, which is what makes the machine locale stop being a test
input.

Two details worth recording:

- **The cross-tab's header labels are built inside a `useMemo`**, so the locale
  joins that dependency array. Threading it into the call alone would leave the
  headers frozen in whatever locale they were first built with — measured, and
  pinned by a case that changes only the locale and asserts the header
  re-labels. Removing just the dependency entry turns exactly that one case red
  and leaves the other nine green.
- **The metadata designer's `locale` prop is deliberately not used.** It carries
  the designer's own chrome language (`useMetadataLocale()`, which resolves to
  exactly `en-US` or `zh-CN`), not a number-formatting locale — a German session
  gets `en-US` from it. The preview's numbers have to match what the report and
  dashboard render for the same dataset, which is `useDisplayLocale()`.

Both packages are `patch`: their published declarations are unchanged (measured
against the built `.d.ts` with `dist/` cleared between builds). The threading is
module-local, and the one signature that gained a parameter — the file-local
`bucketLabel` helper — is not exported.

A side effect of the fallback: these surfaces are now DETERMINISTIC where they
previously followed whatever locale the machine happened to run in.
`useDisplayLocale` ends at a concrete `'en'` rather than the `undefined` that
hands `Intl` the machine's locale.
