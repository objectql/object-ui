---
'@object-ui/plugin-dashboard': patch
'@object-ui/core': patch
'@object-ui/types': patch
'@object-ui/app-shell': patch
---

fix(dashboard,i18n): KPI cards and dashboard filters resolve authored labels instead of dropping them (#4032)

A `type: 'metric'` dashboard widget rendered raw English while every other widget
type on the same dashboard rendered the translation, and dashboard filter chips
rendered `[object Object]` or the raw stored value. Both come from the same
cause: authored labels reaching a render site that could not read the
vocabulary `@objectstack/spec` actually admits.

- **KPI cards rejoin the widget translation channel.** The self-contained
  `metric` branch built its own label from the raw `widget.title`, so the
  `{ns}.dashboards.{dash}.widgets.{id}.title` value the renderer had already
  resolved was computed and thrown away. It now reads that channel like every
  other widget header.
- **The three private `resolveLabel` copies** (`DashboardRenderer`,
  `MetricWidget`, `MetricCard`) are gone. Each read the retired
  `{ key, defaultValue }` key-reference form and ended `defaultValue || key`, so
  handed the inline per-locale map the spec admits today they returned nothing —
  a KPI card with a map title rendered the literal string `metric`. All three
  now use `pickLocalized`, the resolver already used for this vocabulary
  elsewhere in the package.
- **Dashboard filter labels and static option labels resolve per locale.**
  `DashboardFilterDef.label` widens to `string | I18nLabel`, the filter bar
  resolves before rendering (fixing `[object Object]: All` in the trigger, and
  in `aria-label` / `placeholder`), and the `def.label || def.name` gate now
  tests the RESOLVED string — an object is always truthy, so it never reached
  the fallback before.
- **Option labels are no longer discarded.** `normalizeFilterOptions` coerced a
  map label to the raw stored value in every locale, English included, so
  `{ value: 'domestic', label: { en: 'Domestic', … } }` displayed as `domestic`.
  The pair shape is still normalized; the label vocabulary is preserved for the
  render side to resolve.
- **`DashboardComponentSchema.globalFilters` is bound to the spec's
  `GlobalFilter`** instead of restated by hand. The restatement was both too
  narrow (`label?: string`, which is what made these read sites invisible to
  `tsc`) and too wide (it declared a bare-string option shorthand the spec
  rejects at publish).

Plain-string labels are unaffected and render byte-identically.
