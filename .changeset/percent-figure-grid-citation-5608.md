---
---

Comments only — this publishes nothing, declared explicitly with an empty frontmatter
rather than left undeclared (objectui#5608).

Two live sites still carried the bare `27,581 of 1,200,013` figure with neither the grid
nor the measured surface named: the `DisplayNumberFormatOptions.style` doc comment and a
comment in the percentage-points test. Both were accurate. Neither was *reconcilable* — a
reader who had also seen `packages/fields`'s `27,577 of 1,200,003` met two counts that
look like a contradiction, and a figure a reader cannot reconcile is what makes a correct
comment get distrusted wholesale. That is the same defect class objectui#4596 was queued
for, and the wording here is lifted from its PR rather than phrased a third way — a third
phrasing for one fact is the defect one level up.

Both counts stand unchanged. The disambiguator is the surface measured, so each site now
names it: objectui#4576's tie-dense grid (0.005 steps to 2,000, precisions 0/1/2) on
`formatDisplayNumber` / `formatMeasure`'s call shape, against objectui#4590's re-measure
of the same route through `formatPercent`. No value, assertion or behaviour moves.

Why the empty form is the right declaration, stated from what was measured rather than
carried over from objectui#4596's PR — the two cases are mirror images. There, a function
BODY comment was changed, so the emitted `.js` moved and the `.d.ts` did not. Here the
changed source comment is the JSDoc on an exported interface member: the interface erases
at runtime, so the new prose reaches `dist/utils/number-display.d.ts` and is absent from
`dist/utils/number-display.js` (checked on a real build of the package). The second site
is a test file, excluded from the build program by `src/**/__tests__/**` and never in
`dist` at all.

So a consumer-visible byte does move — the text shown on hover. That is documentation of
an existing measurement, not a change to the measurement, the type, or any behaviour:
nothing a consumer types against or calls is different, which is why this releases
nothing. Bytes moving is not the criterion; released behaviour and consumer-visible
surface are, and neither moves.
