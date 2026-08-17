---
'@object-ui/plugin-dashboard': patch
---

Docs only: `packages/plugin-dashboard/README.md`'s TypeScript section no longer
imports two type names that exist nowhere (objectui#5015). Every README import was
judged against the entry module's real export surface — 20 names, read from the
build product's `dist/index.d.ts` through the TypeScript compiler API — and every
corrected snippet was type-checked against that same build product under `strict`.

- **`DashboardSchema`** — taught as the dashboard's schema type, imported from this
  package. Not on its export surface, and not on `@object-ui/types`' either. It
  *looks* present because it occurs in three comments here
  (`src/DashboardRenderer.tsx:884`, `src/DashboardGridLayout.tsx:76` and `:88`) and
  as the name of the metadata-level Zod schema in `@objectstack/spec/ui` — an
  identifier grep hits both, an export-surface check hits neither. The authored
  type does exist under its real name, so the example is rewritten around it rather
  than dropped: `DashboardComponentSchema` from `@object-ui/types`.
- **`MetricCardSchema`** — pure fiction: zero hits repo-wide under a word boundary,
  outside this README. There is no per-widget-family schema type at all — one
  `DashboardWidgetSchema` covers every `type`, and family-specific settings live
  under `options` — so the name could not be corrected to a sibling. The example now
  types its widgets as `DashboardWidgetSchema` and shows the three authored forms
  the type really carries: a dataset-bound KPI, a static single-value widget with
  its number under `options`, and a registered component node in the widget's
  `component` slot.

The section also states what the type set does *not* cover, because the old snippet
implied otherwise: `value`, `trend` and `trendValue` are `MetricCard`'s **component**
props, and `DashboardWidgetSchema` declares none of the three (each measured on its
own, since the first excess property short-circuits the rest of the diagnostic).
`MetricCard`'s props interface is not on this package's export surface either.

No export was added, re-exported or renamed to make the old names true, and the
package's real `dashboardComponents` export is untouched. No code, types or runtime
behaviour change — the diff is one README and this changeset. The correction reaches
npm with the package's next publish, which is why it declares a patch: `README.md`
is in the package's published `files`.
