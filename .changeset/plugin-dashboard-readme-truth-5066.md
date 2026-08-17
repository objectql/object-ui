---
'@object-ui/plugin-dashboard': patch
---

`packages/plugin-dashboard/README.md`: two teaching snippets did not survive being
copied. Both were verified against the package's **build artifact**
(`dist/index.d.ts`) — export names via the TS compiler API
(`checker.getExportsOfModule`), each changed TypeScript block compiled against
those same declarations under `strict`.

- **The `onSchemaChange` persistence example (`TS2345` as written).** The callback
  receives a `DashboardComponentSchema`, whose `name` is optional (`BaseSchema.name`
  in `@object-ui/types`), and `client.meta.saveItem(type, name, item)` declares
  `name: string` (`@objectstack/client@17.0.0`) — so
  `saveItem('dashboard', next.name, next)` is `Argument of type 'string | undefined'
  is not assignable to parameter of type 'string'` in any `strict` consumer. This was
  the one snippet on the page marked `✅ Preferred`, directly under the paragraph
  telling readers that persistence is theirs to wire, i.e. the block most likely to be
  copied whole. It now handles the missing name explicitly (narrow, then write) and
  says why in prose: the type requires it, and what the server does with an absent
  name is **not** measured here, so the example declines to send one rather than
  guessing. No production code was touched to make the old line true — `name` stays
  optional, and the identity question for SDUI dashboard nodes stays with objectui#4600.
- **The `Object.entries(dashboardComponents).forEach(register)` loop.** `dashboardComponents`
  is a real export, but its eleven keys are component class names
  (`DashboardRenderer`, `MetricCard`, `WidgetConfigPanel`, …), not schema types — so
  the loop registered eleven names no schema author writes, tripped the
  no-namespace deprecation warning once per key
  (`packages/core/src/registry/Registry.ts:198`), and registered none of the eight
  types this package actually claims. It did not need to: those eight are already
  registered by the side-effect import on the line above it. The section is replaced
  by the family form used for the sibling plugins — the real register-key table
  (`view:dashboard`, `plugin-dashboard:metric`, `metric-card`, `object-metric`,
  `pivot`, `object-pivot`, `dashboard-grid`, `object-data-table`, with the bare-name
  fallback rule and the two internal `object-*` wrappers named honestly), plus the
  thing the old snippet was reaching for: registering an exported component under a
  key of your own. `dashboardComponents` itself keeps only a statement of measured
  fact, with no recommended usage, because the shape of that export is under
  adjudication in objectui#5064.

No code, types or runtime behaviour change — the diff is one README plus this
changeset. It declares a patch because `README.md` is in the package's published
`files`, so the correction reaches npm with the next release.
