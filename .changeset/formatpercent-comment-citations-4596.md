---
---

Comments only — this publishes nothing, declared explicitly with an empty frontmatter
rather than left undeclared. Two `@object-ui/core` files change and every changed line
sits inside comment syntax; the emitted JavaScript is byte-identical (objectui#4596).

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
