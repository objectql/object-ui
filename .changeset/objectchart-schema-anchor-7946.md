---
"@object-ui/types": minor
"@object-ui/plugin-charts": minor
---

feat(types,plugin-charts): anchor `ObjectChart`'s props to `ObjectChartSchema` and declare the four keys its producers write

`ObjectChart` was published as `(props: any)`, so `ObjectChartSchema` anchored
nothing: every `schema={{ … }}` literal handed to the component was type-checked
against nothing at all. Four keys its producers write and its renderer reads —
`xAxisKey`, `series`, `aggregate`, `filter` — were declared on neither published
copy of the shape, and rode `BaseSchema`'s index signature / `.passthrough()`
unvalidated. That is the mechanism that let objectui#7891's undeclared `config`
rung survive from the day it was written.

Maintainer ruling 2026-09-09 (option A), applying objectui#6576's gallery
treatment to the chart:

- `ObjectChartProps.schema` is `ObjectChartSchema`; the published `.d.ts` no
  longer says `props: any`. `ObjectChartProps` is exported.
- The four keys are declared on BOTH copies, with value types taken from their
  READ sites (`ChartRendererProps` for `xAxisKey` / `series`, `ObjectChart.tsx`
  for `aggregate` / `filter`) rather than copied from any producer's literal.
- `colors` converges: the zod mirror has declared it since objectui#3913 and the
  TS interface did not, a drift no ratchet could see because a mirror-only key
  is in neither of the parity guard's two difference ledgers.

Two of the four are AUTHORABLE (`aggregate`, `filter` — the spec names this
component's own props as their carrier and parses `aggregate` at the react-page
publish gate) and two are INTERNAL, relay-composed (`xAxisKey`, `series` — every
producer computes them and the spec's author-facing vocabulary refuses the
internal spellings by name). The internal pair is declared anyway, because it was
already passing through unvalidated: declaring buys the value check without
minting authorable vocabulary, and each description says which it is.

BEHAVIOUR, from what the anchor made visible: `ObjectChart` resolved the
group-by column twice and only one site normalised the structured
`groupBy: { field, dateGranularity }` node. The other used the raw union as a row
index, a field name and a drill-filter key, so a date-bucketed chart lost its
option-colour resolution, its label→raw reverse map and its drill filter to a
lookup on the node's stringification. Both sites now share one normalisation.

⚠️ Anchoring does not buy rejection of a MISSPELLED key: `BaseSchema` carries
`[key: string]: any` (objectui#5155), the same ceiling objectui#6576 accepted.
What it buys is that a wrong VALUE TYPE is now a compile error.
