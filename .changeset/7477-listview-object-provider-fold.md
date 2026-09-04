---
'@object-ui/core': minor
---

ListView: fold `data={{ provider: 'object', object }}` onto `objectName`, and read the
author's view kind from `specType` / `type` (objectui#7477 — step 6 of #2890, released
by the maintainer's ruling B on objectstack#14791, 2026-09-03).

**What was broken.** A react page bound the way the published `react-blocks` contract
recommends —

```jsx
<ListView data={{ provider: 'object', object: 'crm_task' }} type="kanban" />
```

— validated green against `@objectstack/spec` and then rendered an **empty grid** with no
diagnostic. Both halves of that binding were inert in the renderer: `ListView` read
`data.provider === 'object'` at zero sites (`'value'` and `'api'` are both live there, so
the gap was real and not a dead instrument), and it read `specType` — the slot the react
page tier parks an author's `type` in, because the SDUI envelope claims the `type` key
(ADR-0078) — at zero sites, so an absent `viewType` forced the view to `grid`.

**What changed.** `normalizeListViewSchema` (`@object-ui/core`) gains two folds. Per
AGENTS.md #0.1 they live in the one documented normalizer — not as a seventh per-block
copy of the six sibling `data.object` reads, and not as a renderer-side `??` dual-read.

- `data: { provider: 'object', object }` → `objectName`. The `object` provider is a
  `strictObject` carrying exactly `{ provider, object }`, so `objectName` captures all of
  it. Two deliberate departures from the folds around it, both narrowing: an
  already-present `objectName` **wins** (the fold only fills a gap and can never re-point
  a binding that already resolves), and `data` is **not** deleted — it has four
  providers, `api`/`value` are read live, and the block is forwarded to child views whose
  own `getDataConfig` reads `data` before `objectName`.
- the author's view kind is read from `specType`, then from a bare `type` when it names a
  kind ListView draws (the component discriminator `'list-view'` never does) — the same
  two legs, in the same order, as `normalizeChartSchema`'s chart-family read. An explicit
  `viewType` still wins; this only fills the gap that used to resolve to `grid`, and a
  kind ListView does not draw is left to that `grid` default rather than written through.

**Accept behaviour widens.** Metadata that previously had no effect now binds a view: a
list view carrying an `object` data source, or an author `type`, renders differently
after this change than before. Nothing that renders today renders differently. No
authored spelling is removed here — `objectName` / `viewType` remain accepted; their
retirement is objectstack's, after this ships.
