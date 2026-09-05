---
'@object-ui/types': minor
---

`ChartDataSeriesSchema` (and its TS twin `ChartDataSeries`) now REFUSES `chartType` on a chart
series BY NAME and points at `type` — the renderer-internal spelling the non-strict Zod object had
been **stripping in silence** while `safeParse` reported success (objectui#7694, the `domain:ui` PM
ruling on objectui#7546: option A, a named alias refusal, the posture `@objectstack/spec` already
takes).

⚠️ Shipped as `minor`, not `patch`, because this is a NARROWING of a published accept surface, and
it is named here in the words a release reader can act on:

- **Before:** `series: [{ name: 'revenue', chartType: 'line' }]` validated green through
  `@object-ui/types/zod` (`safeValidateSchema`, `objectui check` / `objectui validate`, any
  pipeline that keeps `parse()`'s output) — and the key was gone from the output, so a consumer of
  the parse result drew that series in the chart's own family, precisely what the author was
  overriding. On the TypeScript face the key was merely an excess property on a fresh literal;
  a widened object carrying it assigned structurally.
- **After:** the same document REFUSES at `series[i].chartType` (issue code `invalid_type`) with
  one message on both channels — the parse-time issue and the `.describe()` metadata:
  `Unrecognized key(s) on this chart series: \`chartType\`. Did you mean \`chartType\` → \`type\`? …`
  followed by the reason and the remedy. Write `type: 'bar' | 'line' | 'area'`. On the TypeScript
  face `ChartDataSeries.chartType` is a `?: never` tombstone, so both the fresh literal and the
  widened assignment are `tsc` errors.
- **Both written** (`{ type: 'bar', chartType: 'line' }`) is refused at `chartType` alone — the
  key is not folded onto `type` and no precedence is minted between the two spellings.

This repository's `major` is a cross-repo pin to `@objectstack`'s major, not a severity dial; the
break is announced here, which is the channel that carries it.

## Why a refusal, and not the two alternatives

`chartType` is the renderer's INTERNAL spelling of `type`: the first limb of `normalizeSeries`'
`str(raw.chartType) ?? str(raw.type)` (`@object-ui/plugin-charts`, `normalizeChartSchema.ts:244`),
written by the internal-shape producers that hand `dataKey`-shaped arrays straight to
`ChartRenderer` (`ObjectChart`, `DatasetWidget`; `core/utils/chart-presentation` translates authored
`type` *into* it) and by nothing an author writes. Re-measured at implementation time, series-level,
with lit controls (`dataKey` / `name` / `type` / `color`): docs 0, fixtures 0, designer inputs 0
(the `chart` registration's `series` is one `code` input), src literals 0, tests 9 — every one an
internal-shape array that never meets this mirror. Limb ablation over 304 files / 5817 tests:
deleting `str(raw.chartType) ??` left all green; deleting the `?? str(raw.type)` sibling went 2 red.

- **Not a fold onto `type`.** The renderer takes `chartType` FIRST, so a fold would let the alias
  overwrite the canonical key when both are written — the inversion of the objectui#7113 precedence
  rule (`xAxis` → `xAxisKey` folds *because* the reader already prefers the canonical key).
- **Not a second writable name.** `@objectstack/spec`'s `ChartSeriesSchema` lists `chartType` in its
  alias map as a spelling of `type` and refuses it by name; declaring it here would mint a second
  de-facto contract against the spec's own posture (AGENTS.md #0.1).

## The primitive, and the JSON-Schema surface

The new `aliasKeyRefusal()` helper (`zod/tombstone.zod.ts`, internal — not re-exported) reuses
`retirementTombstone`'s primitive, `z.never({ error }).optional().describe()`, deliberately not
`handlerKeyRefusal`'s `z.custom`: measured, `z.toJSONSchema` throws on a `z.custom` arm ("Custom
types cannot be represented in JSON Schema") and represents a `z.never` arm as `{ not: {} }` with its
description. `z.toJSONSchema(ChartDataSeriesSchema)` succeeded before this change and still does —
it now lists `chartType` as a refused property carrying the guidance.

## Unchanged, deliberately

The object stays non-strict — a truly undeclared key is still stripped, exactly as
`chart-inline-data-retired.test.ts` pins. The six keys objectui#7546 declared, the `data` tombstone
(objectui#6896) and the at-least-one-binding refinement (objectui#6939 / #7113) are untouched.
**No reader changed:** `normalizeSeries` still reads `chartType` first on the internal-shape arrays
its producers hand it; that limb is a reader decision, not this declaration's.

## FROM → TO

```ts
// ChartDataSeries
+ chartType?: never;   // alias of `type` — refused by name; write `type`
```

Pinned in `packages/types/src/__tests__/chart-series-chart-type-alias-refusal-7694.test.ts` —
the refusal envelope, both-written, the TS face, the spec's own posture measured live on the
installed `@objectstack/spec`, and the JSON-Schema surface; `chart-series-keys-7546.test.ts` block
(d) now pins the handoff from the gap that card reported.
