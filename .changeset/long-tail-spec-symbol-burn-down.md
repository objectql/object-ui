---
"@object-ui/collaboration": major
"@object-ui/fields": major
"@object-ui/layout": major
"@object-ui/plugin-charts": major
"@object-ui/plugin-detail": major
"@object-ui/plugin-form": major
"@object-ui/plugin-grid": major
"@object-ui/providers": major
"@object-ui/runner": major
"@object-ui/sdui-parser": major
---

Stop declaring 14 symbols across ten packages under names `@objectstack/spec`
owns (objectui#3161, objectstack#4115 batch 7 — the long tail, one or two
entries per package). All ten packages leave the ledger, which drops from 17
collisions across 11 packages to 3 across 1.

**Renamed exports** — in every case the spec exports the same name for a
*different* thing, so the old name was a mis-description rather than a dialect:

| package | was | now | what the spec's same-named export is |
|:--|:--|:--|:--|
| `@object-ui/fields` | `FieldWidgetProps` | `FieldWidgetComponentProps` | the DECLARED field-widget plugin props contract (a zod object; `field.type` is the `FieldType` enum, `readonly`/`required` carry defaults) |
| `@object-ui/layout` | `PageHeaderProps` | `PageHeaderComponentProps` | the authored `page:header` node — a zod schema of `title`, `subtitle`, an icon NAME, `breadcrumb`, `actions: string[]` |
| `@object-ui/layout` | `Page` | `PageNodeRenderer` | the authored page metadata DOCUMENT (`name`, `label`, `type`, `regions`) |
| `@object-ui/plugin-detail` | `ObjectFieldLike` | `ObjectDefFieldLike` | the i18n duck type `translateObject` walks (`help`/`description`, plus `[key: string]: any`) |
| `@object-ui/plugin-grid` | `ColumnSummaryConfig` | `ColumnSummarySetting` | the OBJECT form of `ListColumn.summary` **only** — the local one was the whole union, shorthand included |
| `@object-ui/plugin-grid` | `isMultiValueField` | `hasMultiValueShape` | the spec's classifier, which requires a def with a `type`; the local one is called with `undefined` |
| `@object-ui/collaboration` | `RealtimeConfig` | `RealtimeSubscriptionConfig` | the app's realtime DECLARATION (`enabled`, `transport`, `subscriptions[]`) |
| `@object-ui/plugin-charts` | `ChartConfig` | `ChartContainerConfig` | the authored chart document (`type`, `xAxis`, `series`, `showLegend`, …) |
| `@object-ui/plugin-form` | `FormSection` / `FormSectionProps` | `FormSectionContainer` / `FormSectionContainerProps` | the authored form-section metadata (`name`, `pane`, `visibleWhen`, `fields`) |
| `@object-ui/providers` | `Theme` | `ThemePreference` | a whole theme DOCUMENT (`name`, `label`, `colors`, `typography`) |
| `@object-ui/runner` | `App` (default export) | `RunnerApp` | the authored application metadata type **and** the `App.create()` builder |
| `@object-ui/sdui-parser` | `ValidationResult` | `ManifestValidationResult` | plugin-manifest validation (`{ valid, errors?, warnings? }`), exported from both `kernel` and `contracts` |

`ManifestValidationResult` follows the `<what was validated>Validation<Error|Result>`
convention registered on objectstack#4115 (`@object-ui/core` took
`SchemaNodeValidationResult` in batch 4). `PageHeaderComponentProps` deliberately
reuses the name `@object-ui/app-shell` already chose for its own header props in
batch 3, so one concept does not acquire two dialect names one package apart.

**Now derived from the spec instead of hand-written:**

- `@object-ui/fields` — `isFileIdToken` is re-exported from
  `@objectstack/spec/data`. The local copy was character-for-character identical
  to the spec's function while its comment said it "mirrors" it, so every
  behaviour test passed and only reference identity could tell the two apart.
  The regex is a wire decision: widening it server-side while a copy here kept
  the old bound would make every new id read as "not a reference", and the
  widget would submit the legacy inline blob to a backend expecting a reference.
- `@object-ui/plugin-detail` — `FeedFilterMode` is re-exported from
  `@objectstack/spec/data`, in a file that already imported the sibling
  `FeedItemType` from the spec.
- `@object-ui/plugin-grid` — the eleven-member aggregation union is now the
  spec's `ColumnSummary` enum, so the total `Record<ColumnSummaryType, string>`
  label map turns a member the spec adds into a compile error instead of a
  blank footer cell. `ColumnSummarySetting` is `NonNullable<ListColumn['summary']>`,
  i.e. whatever forms the spec itself accepts. `hasMultiValueShape` delegates to
  the spec's `isMultiValueField` rather than re-deriving it from
  `MULTI_OPTION_TYPES` / `MULTI_CAPABLE_TYPES`.
- `@object-ui/providers` — `ThemePreference` is the spec's `ThemeMode` union
  plus the one legacy `'system'` spelling this provider still honours for stored
  preferences, read off the schema's own `_zod` carrier so the package takes no
  zod dependency.

`@objectstack/spec` moves from `devDependencies` to `dependencies` in
`@object-ui/fields` (it re-exports a runtime function) and `@object-ui/providers`
(its public `.d.ts` now references the spec).
