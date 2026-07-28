---
"@object-ui/types": patch
---

refactor(types): retire the hand-written @objectstack/spec/ui sub-schema mirrors (#2231 phase 2)

The zod schemas that carried a "Mirrors @objectstack/spec/ui X" header are now the
spec's schemas **by reference** instead of hand-maintained copies, closing the
double-maintenance / silent-divergence gap the same way #2622 did for `ListViewSchema`:

- `objectql.zod.ts` — `HttpMethodSchema`, `HttpRequestSchema`, `ViewDataSchema`,
  `SelectionConfigSchema`, `PaginationConfigSchema` are direct re-exports.
  `ListColumnSchema` derives from the spec base plus the two sanctioned
  objectui-only extensions: `prefix` (ObjectGrid compound cells) and a broadened
  `summary` (the spec `ColumnSummarySchema` enum ∪ the `{ type, field }` object
  form `useColumnSummary` supports).
- `theme.zod.ts` — `ColorPaletteSchema`, `TypographySchema`, `SpacingSchema`,
  `BorderRadiusSchema`, `ShadowSchema`, `BreakpointsSchema`, `AnimationSchema`,
  `ZIndexSchema`, `ThemeModeSchema`, `ThemeLogoSchema`, `ThemeDefinitionSchema`
  all resolve to the spec's schemas.

Validation deltas picked up from the spec (drift the mirrors had accumulated):
`ViewDataSchema` gains the `provider: 'schema'` variant; `HttpRequestSchema.method`,
`SelectionConfigSchema.type` and `PaginationConfigSchema.pageSize` now apply spec
defaults on parse; `ListColumnSchema.summary` accepts the full spec aggregation
vocabulary but no longer accepts arbitrary strings; `AnimationSchema.timing` keys are
the spec's snake_case (`ease_in` — what the runtime reads) instead of the mirror's
camelCase; `ThemeDefinitionSchema` gains `density`/`wcagContrast`/`rtl`/`touchTarget`/
`keyboardNavigation` and its `mode` default follows the spec (`'light'`).

A new drift-guard (`spec-subschema-parity.test.ts`) asserts reference identity for
every re-export, so re-forking — including a faithful copy — fails CI.
