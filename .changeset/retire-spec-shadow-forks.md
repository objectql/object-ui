---
"@object-ui/types": minor
---

refactor(types): retire the five forks that shadowed a `@objectstack/spec` vocabulary (#2944)

Five declarations in `@object-ui/types` restated a spec vocabulary, four of them
re-exported under **the spec's own symbol name** — so an importer could not tell
which definition they had. Every one had already drifted:

| Declaration | Was | Spec |
|---|---|---|
| `ChartTypeSchema` (`zod/data-display.zod.ts`) | 7 values | **19** |
| `ChartType` (`data-display.ts`) | 7 values | **19** |
| `PageTypeSchema` (`zod/layout.zod.ts`) | 4 — no `list` | 5 |
| `PageType` (`layout.ts`) | 10 — five the spec repudiates | 5 + local |
| `ReportType` (`reports.ts`) | 3 — no `joined` | 4 |
| `ActionType` (`ui-action.ts`) | 5 — no `form` | 6 |

All are now the spec's schema by reference, or its type re-exported/derived.

**This is why #2901 was filed with an inverted premise.** It read the 7-value
`ChartTypeSchema` as the protocol and concluded `plugin-charts` had outgrown it
with renderer-local dialect. The spec has 19; the 7-value list was this fork.

**Widening only for consumers.** `ActionType` gains `form` (which
`ActionRunner.executeForm` already implemented, so a host app previously got a
type error on working code), `ReportType` gains `joined`, `ChartType` goes 7 → 19,
and `PageTypeSchema` gains `list`. Nothing was removed, so no existing value
stops type-checking or validating. Verified against the whole repo: 76/76
type-check tasks and 8215 tests pass.

**`PageType` keeps a named local extension.** `grid`/`gallery`/`kanban`/
`calendar`/`timeline` are visualizations, not page kinds — `ui/page.zod.ts` says
so outright — but narrowing them away is a breaking type change for anyone
assigning `pageType: 'kanban'`. They are now `PageVisualizationAlias`, a
sanctioned and documented local extension (issue #2231's prescription) rather
than five names hidden inside a hand-written union. Removing it is the separate
"visualizations are not page types" cleanup.

Guarded going forward: `spec-subschema-parity.test.ts` pins the two zod schemas
**by reference** (a faithful copy fails, because a copy is a fork), and the new
`spec-derived-unions.test.ts` covers the type aliases, which reference identity
cannot reach.
