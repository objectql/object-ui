---
'@object-ui/types': minor
---

Retire `ChartDataSeries.data`, and correct `ChartSchema.categories`' prose to the read it
has always had (objectui#6896, ADR-0049 enforce-or-remove; maintainer ruling 2026-08-31).

⚠️ **BREAKING for anyone authoring a static `ChartSchema` node**, shipped as `minor`
because this repository's `major` is a cross-repo pin to `@objectstack`'s major rather than
a severity dial. The break is announced here, which is the channel that carries it.

## `ChartDataSeries.data` — RETIRED

`data: number[]` was **required** on every authored series and read by nothing.
`normalizeChartSchema`'s `normalizeSeries` (`@object-ui/plugin-charts`) reads `dataKey` /
`name`, `label`, `chartType` / `type`, `variant`, `opacity`, `dashArray`, `stack`, `yAxis`
and `color` — `data` is not among them. Rows come from the chart node's **chart-level**
`data`, a key `ChartSchema` never declared at all, which survives only because `BaseSchema`
carries an index signature and so suppresses excess-property checking on chart literals.
The declaration therefore demanded numbers no reader consumed, and no author could omit
them.

FROM → TO:

- `data: number[]` (required) → **`data?: never`**, an ADR-0049 retirement tombstone. Put
  the rows on the chart node's chart-level `data`, name the column with the series' `name`
  (or `dataKey`), and put the category axis on `xAxisKey`.

The accept set moves in **both** directions, and both are deliberate:

- **narrowing** — `{ name: 'Revenue', data: [1, 2, 3] }` was accepted and is now refused;
- **widening** — `{ name: 'Revenue' }` was refused (`data` was required) and is now
  accepted, which is the shape the renderer has always read.

Deleting the member outright was the option **not** taken: `ChartDataSeriesSchema` is a
non-strict `z.object`, which strips an undeclared key in silence — one silent no-op traded
for another. The tombstone keeps the key declared and unwritable, so an authored value is a
**named refusal carrying its own remedy**: `?: never` on the interface (a `tsc` error at the
authoring site) and `retirementTombstone()` on the Zod mirror (`code: 'invalid_type'`, the
key named in the issue `path`, the migration note as the message). Per the ruling —
创业阶段不渐进 — the tombstone is immediate: there is no deprecation window and no
dual-reading period.

## `ChartSchema.categories` — NOT retired; its prose was wrong

The key keeps its behaviour. It is read as an **alternative series list**, consulted only
when `series` is absent, each entry normalized through the same series normalizer where a
bare string means `{ dataKey }` — so the strings name **columns to plot**. The category axis
comes from `xAxisKey` / `xAxis`. The docblock said "X-axis labels/categories", so an author
following the documentation got a different chart from the documented one. Prose follows
machine: the docblock, the `ChartDataSeries` header (which promised numbers "positionally
aligned with the chart's `categories`", a model that never existed) and the Zod
`.describe()` were corrected to the read. No behaviour changed, and `categories` remains
writable.

## The census behind the retirement, re-measured on this branch

Re-measured at merge-base `2c3cd1b75` rather than inherited from the card, with a control
that had to hit in the same query — the instrument was not blind: it scores
`packages/types/src/__tests__/report-schema-authoring-face.test.ts` **4** authoring sites.

⚠️ One correction to the record the ruling rests on. The ruling states *zero* authorship of
a populated `series[].data` outside tests across `packages/` / `apps/` / `examples/`. The
re-measurement finds **one such site inside those roots** —
`packages/types/examples/data-display-examples.json` (2 series) — plus **four outside**
them, in documentation: `content/docs/api/schema-reference.md` (3) and
`content/docs/core/report-schema.mdx` (1).

Every one of the five is documentation or an unreferenced example, **not a consumer**: none
is imported, type-checked, parsed by a test or rendered anywhere, `packages/types` does not
publish its `examples/` directory, and each authors the *documented* model — month names in
`categories` next to inline `series[].data` — which renders an empty chart today, because
`data` is dropped and `categories` is ignored whenever `series` is present. They are
instances of the divergence this change closes rather than users of a working inline-data
model, so the ruling's conclusion is unaffected. Their migration is filed separately; until
it lands, an author copying them now trips the tombstone and reads the remedy instead of
being silently dropped.

Pinned in `packages/types/src/__tests__/chart-inline-data-retired.test.ts` — both channels,
the announcement itself, and a counter-probe that builds the deletion this retirement did
not choose and measures the contrast in the same run — and in
`packages/plugin-charts/src/normalizeChartSchema.test.ts`, where the `categories` read now
has behaviour coverage it never had.
