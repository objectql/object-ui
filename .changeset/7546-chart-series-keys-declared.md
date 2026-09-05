---
'@object-ui/types': minor
---

`ChartDataSeriesSchema` (and its TS twin `ChartDataSeries`) declares the six series keys the
renderer reads — `label`, `variant`, `opacity`, `dashArray`, `stack`, `yAxis` — which the
non-strict Zod object had been **stripping in silence** while `safeParse` reported success
(objectui#7546, `domain:ui` PM ruling: measure per key, declare what is live, report the rest).

⚠️ Shipped as `minor`, not `patch`. The declared value domains are the read's own, so the accept
set widens toward what already renders — but one document class that validated before now
**refuses**: a series carrying one of these keys with a value the renderer drops in silence
(`variant: 'bogus'`, `yAxis: 'top'`, `opacity: '0.4'` / `Infinity`, a non-string `stack` /
`dashArray`, a non-string non-map `label`) — and, separately, `variant: 'current'`, which the
renderer does NOT drop: the normalizer keeps that renderer-internal spelling and draws it exactly as
`primary`, but it is not a member of the published pair, so it now refuses at `variant` (below).
Such a document draws a chart today — the normalizer ignores the bad value, or honours `current`
— so this is a narrowing away from something that renders, which is the
distinction objectui#6939's grading language turns on, and it takes the level objectui#6896 and
objectui#7113 set for the same transition in this same file. This repository's `major` is a
cross-repo pin to `@objectstack`'s major, not a severity dial; the change is announced here.

## The defect, measured

`ChartDataSeriesSchema` is a non-strict `z.object` — not `.passthrough()` like `BaseSchema` — so an
undeclared key is removed, not kept. Reproduced red on `origin/main` `a472b071` before the change:

```
input : { name, label, stack, yAxis, opacity, dashArray, variant }
parse : success = true
output: { name }
```

Every one of the six is read by `normalizeSeries` (`@object-ui/plugin-charts`,
`normalizeChartSchema.ts:242-255`) and does real work in `AdvancedChartImpl.tsx` — `label` names
the legend entry, `variant === 'comparison'` selects the muted overlay, `opacity` / `dashArray` set
stroke and fill, `stack` becomes Recharts' `stackId`, `yAxis` binds the secondary axis. Any consumer
of the parse output — `objectui check` / `objectui validate` via `safeValidateSchema`, a JSON
schema derived from the mirror, or any pipeline that keeps `parse()`'s result — lost them outright.

## Per-key liveness, not a blanket declare

"The renderer reads it" was ruled insufficient (a read leg can sit on a value nothing produces —
objectui#7642), so each key was measured on producers, real work in the reader, and consumer
surprise, with a lit control on every count. The six are `@objectstack/spec`'s own
`ChartSeriesSchema` members under the same names and value domains; this node's `series`
accepts the spec shape by design; in-repo producers write them onto `type: 'chart'` nodes
(`DashboardRenderer`, `ObjectChart`, `DatasetWidget`, `core/utils/chart-presentation`); and
the `variant` / `yAxis` narrowings are design intent the reader already enforces.

**`chartType` — the seventh key the review found — is deliberately NOT declared.** It is the first
limb of `str(raw.chartType) ?? str(raw.type)`, but it is the renderer's *internal* spelling of the
declared `type`; the spec's `ChartSeriesSchema` lists it as an alias of `type` and refuses it by
name; and zero documents, fixtures, catalog entries or designer inputs write it on this face
(controls lit). Declaring it would mint a second writable name for one override. It is reported
for its own card; the mirror still strips it, and the pin test holds that gap visible.

## FROM → TO

```ts
// ChartDataSeries — all optional, all additive on the TS face
+ label?: string | I18nLabel;                       // spec I18nLabel: string | inline locale map
+ variant?: 'primary' | 'comparison';               // the spec's own pair
+ opacity?: number;                                 // finite; NaN / Infinity / strings refused (the spec's 0–1 bound is not enforced — the read's domain)
+ dashArray?: string;
+ stack?: string;
+ yAxis?: 'left' | 'right';
```

`variant` is the spec's own pair. The normalizer also tolerates a third spelling, `current`, but that
is the renderer's internal default — written only by the compare-to producers (`ObjectChart`,
`DatasetWidget`) onto internal-shape arrays that never pass this mirror, and by nothing an author
writes (docs, fixtures, designer inputs: 0, controls lit) — so it is not a member here: declaring it
would have fossilised a renderer-side tolerance into a second contract. The normalizer's tolerance
is unchanged; objectui#7682 owns that decision.

## Unchanged, deliberately

The object stays non-strict — a truly undeclared key is still stripped, exactly as
`chart-inline-data-retired.test.ts` pins; this change declares what is read, it does not close
the object. The `data` tombstone (objectui#6896) and the at-least-one-binding refinement
(objectui#6939 / #7113) are untouched. No reader changed.

Pinned in `packages/types/src/__tests__/chart-series-keys-7546.test.ts` — the card's fixture
surviving byte-for-byte, each key on the mirror's own `.shape`, each value domain refusing at its
own path, the TS face in lockstep, and the `chartType` gap.
