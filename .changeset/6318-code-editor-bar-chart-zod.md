---
"@object-ui/types": minor
---

Model `code-editor` and `bar-chart` in `AnyComponentSchema`, and repair three catalog fixtures

Both types render — `@object-ui/plugin-editor` registers `code-editor`,
`@object-ui/plugin-charts` registers `bar-chart` — and neither had a Zod member,
so `safeValidateSchema` (and therefore `objectui validate`) refused every
document that named them, whatever the document said. `CodeEditorSchema` and
`BarChartSchema` are now declared in `@object-ui/types` and mirrored in
`@object-ui/types/zod`, derived key-for-key from what the two renderers
demonstrably read rather than from a view of what either component ought to
accept.

Alongside them, three `examples/schema-catalog` entries that were wrong about
their own renderer: `basic-select`'s third option spelled its label `type`, so
the option rendered blank; `icon-toolbar`'s buttons carried only `icon`/`value`,
which `button-group` never reads, so all three rendered blank; and `basic-tabs`
gave its items no `value` and no `defaultValue`, so no panel could be selected.
