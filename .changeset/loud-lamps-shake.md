---
"@object-ui/react": minor
"@object-ui/plugin-detail": minor
"@object-ui/plugin-grid": minor
"@object-ui/plugin-form": minor
---

`object-grid` / `object-form` / `detail-view` resolve their data source the same way, and a block that resolves none says so

The three object-bound blocks disagreed about how the data-source adapter reached
them. `object-grid` and `object-form` were registered through wrappers that read
it from `SchemaRendererProvider` context; `detail-view` was registered as the raw
component, which reads a React `dataSource` prop. `SchemaRenderer` itself reads
only context, so the two wirings were mutually exclusive: measured with correct
keys in every cell, provider wiring gave the grid `find` 1 and the detail view
`findOne` 0, and prop wiring gave exactly the reverse. Neither reported anything.

All three now resolve the adapter through one rule — an explicit `dataSource`
prop first, the provider context second. This is additive: `detail-view` keeps
its prop form (and direct `<DetailView dataSource={…} />` callers are untouched),
`object-form` gains a prop form it did not have, and `object-grid` no longer
throws `useSchemaContext must be used within a SchemaRendererProvider` when a
page has no provider.

And the silence is over. A block in this family that resolves no adapter renders
a **No data source resolved** panel naming the block, the object it was about to
read, and the ancestor that injects the adapter — instead of a header-only grid,
a field-less form card, or nothing at all. The check is opt-in per block, so a
placement with inline rows, inline `customFields`, an inline record or an `api`
endpoint is untouched.

New from `@object-ui/react`: `useResolvedDataSource`, `NoDataSourcePanel`,
`noDataSourceMessage`, and a `requiresDataSource` prop on `ElementDataSourceGate`.
