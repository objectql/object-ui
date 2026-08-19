---
'@object-ui/plugin-dashboard': minor
---

`ObjectMetricWidgetProps` now speaks `@objectstack/spec`'s `I18nLabel` vocabulary on `label`, `trend.label`, `description` and `title`.

These four members still declared `string | { key?: string; defaultValue?: string }`
— the key-reference label form `@objectstack/spec` RETIRED at 17.0.0-rc.6
(objectstack#5055). The sibling `MetricWidgetProps` was migrated to
`string | I18nLabel` for exactly this reason in objectui#4358; this interface was
missed in that pass, and it was the last declaration of the retired shape in any
package's shipped `src` (objectui#5264).

It was not inert. `ObjectMetricWidget` forwards `label` / `description` / `trend`
straight to `MetricWidget`, which resolves them with `pickLocalized`. The retired
object matches no locale limb, so resolution fell through to that resolver's last
resort — the first string property in insertion order — and a metric authored in
the natural `{ key, defaultValue }` spelling painted the RAW DOTTED TRANSLATION KEY
onto the KPI card as its visible label. Written the other way round the English
fell out instead. That property-order dependence is why the defect never read as
systematic in review.

Breaking semantics, stated per this repo's version policy (objectui's own
breaking changes ship as `minor` so the fixed group's major stays aligned with
`@objectstack`; see AGENTS.md §版本号策略):

- **What starts type-checking:** the inline per-locale map — `label={{ en:
  'Revenue', 'zh-CN': '收入' }}` — which is the ONLY object form the spec admits
  today. Against the old declaration it was a compile error (TS2322/TS2353,
  excess property `en`), so a consumer writing the correct vocabulary could not
  build. This is the substance of the change and it is a WIDENING.
- **What stops type-checking:** nothing in practice. `I18nLabel`'s object half is
  `InlineLocaleMap`, which erases to `Record<string, string>` in the emitted
  `.d.ts` — the BCP-47 key regex is a Zod runtime refinement and does not survive
  into the type — so `{ key, defaultValue }` remains structurally assignable. The
  retired form is refused where refusal is expressible: `I18nLabelSchema` rejects
  it at authoring time, in both property orders. No renderer-side tolerance was
  added for it (AGENTS.md #0.1).
- **Behaviour change on the drill-down panel title.** `drawerTitle` read
  `title?.defaultValue` / `label?.defaultValue` directly. An inline per-locale map
  has no such limb, so an authored drill title resolved to `''` and the drawer
  silently fell back to the literal word "Details". It now resolves through the
  same `pickLocalized` and the same UI language as the tile, so the drawer and the
  card that opened it can no longer disagree. A metric still passing the retired
  form (only reachable by cast, or from stored metadata) sees the drawer follow
  the card instead of diverging from it.
