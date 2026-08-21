---
---

Comments only — this publishes nothing, declared explicitly with an empty frontmatter
rather than left undeclared (objectui#4596).

Why the empty form is the right declaration here: both changed comments are **internal
reasoning**, not consumer-visible API documentation. One sits inside `formatMeasure`'s
body; the other is a test-file header. No released behaviour changes, and no declaration
changes — `dist/utils/dataset-format.d.ts` is byte-identical across this change
(measured: sha `be5f5938…`, 10,580 bytes on both sides), so nothing a consumer types
against or reads on hover moves.

Stated honestly, because an earlier draft of this note got it wrong: the shipped
JavaScript **does** change. `tsconfig.base.json` sets `removeComments: false`
deliberately and `@object-ui/core` builds with a plain `tsc`, so a body comment is
emitted — `dist/utils/dataset-format.js` goes from 14,716 to 15,457 bytes, and it is the
only one of the package's 180 dist files that moves. The test file is excluded from the
build program (`src/**/__tests__/**`) and never reaches `dist` at all. Bytes moving is
not the criterion; released behaviour and consumer-visible surface are, and neither does.

Three comments cited `formatPercent` as the live example of the divide-by-100 percent
route. Each was accurate when written and stopped being true when objectui#4590 landed:
`formatPercent` renders through `style: 'percentPoints'` with no division. The comments
now argue the route on its own merits without the expired citation, and record what
replaced it — no caller in this repo takes the divide-by-100 route today. `formatPercent`
was the last one; the two remaining `style: 'percent'` sites hand `Intl` a FRACTION, which
is that style's own contract, and the route otherwise survives only where a test builds it
in order to show it disagreeing.

The measured argument underneath is unchanged, and the tie / extreme-magnitude pins that
keep the percentage-points route honest are untouched. The `27,581 of 1,200,013` figure
now names the grid it came from — objectui#4576's tie-dense grid, 0.005 steps to 2,000,
precisions 0/1/2, on `formatMeasure`'s call shape — so it stops reading as a discrepancy
against objectui#4590's `27,577 of 1,200,003`, which is the same grid re-measured through
`formatPercent`.
