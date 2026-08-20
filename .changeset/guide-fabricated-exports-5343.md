---
---

Docs + gate-ledger only (objectui#5343). The getting-started guides under
`content/docs/guide/**` and `content/docs/api/schema-reference.md` documented 14 symbols
the packages do not export; a reader who copied one of those imports got a compile error,
not a degraded render. Each symbol got ONE disposition, taken from the packages' built
`dist/index.d.ts` and applied at every site:

- renamed — `PageSchema` → `PageNodeSchema`, `DashboardSchema` → `DashboardComponentSchema`,
  `AppSchema` / `ThemeSchema` / `ReportSchema` → `AppComponentSchema` /
  `ThemeComponentSchema` / `ReportComponentSchema` (type and zod entries both),
  `componentSchema` → `ComponentSchema`, `registerDefaultRenderers` /
  `registerAllComponents` → `initializeComponents()` plus the side-effect
  `@object-ui/fields` import, `getComponentRegistry()` → the `ComponentRegistry` singleton;
- wrong package — `BaseSchema`, `PageSchema` and `FormSchema` were claimed from
  `@object-ui/core` while they live in `@object-ui/types`;
- removed with nothing replacing it — `InputRenderer`, the `ObjectSchema` / `Field`
  builder pair and `getExpressionEvaluator`: those examples are gone and the pages teach
  the real surface instead.

No published behaviour changes: no package's runtime source was touched. The
`UNGATED_DOCS` entries in `scripts/check-doc-snippet-types.mjs` are rewritten to the
diagnostic mix each page now measures — every bucket equal or lower, nothing added.
