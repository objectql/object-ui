---
'@object-ui/plugin-dashboard': patch
---

`ObjectDataTable` no longer writes six undeclared keys into the `data-table` columns slot
(objectui#6373). `enrich()` returned `NormalizedColumn`, whose `[key: string]: any` accepts
anything, so nothing checked the producer's output against
`DataTableSchema.columns: TableColumn[]`: `{ ...col, ...fieldMeta }` spread `label`,
`options`, `referenceTo`, `format`, `currency` and `decimals` onto every emitted column, and
`TableColumn` declares none of them.

The measured read set of the consumer (`data-table.tsx`, comments stripped) contains none of
the six, so all six retire from the emit rather than being declared — declaring a key nothing
reads is the same `declared != enforced` defect facing the other way. Rendering is unchanged
because none of those keys was the live path for its own value: the `FieldMeta` the `cell`
closure captures is what this widget's type-aware rendering has always read, and it is
untouched. Authored spellings still pass through, so a column the author wrote as
`{ format: '$0,0' }` keeps its `format` exactly as before.

`type` is unchanged — objectui#5853's fold at this seam still applies. `name` is unchanged
and still written: `data-table` reads `col.accessorKey || col.name` and objectui#5120 holds
that alias while two published skill guides still teach a `{ name, label }` column. The hold
is now declared at the seam instead of arriving anonymously inside a spread.

The seam's emit type carries ADR-0049 `?: never` tombstones for the retired keys rather than
being a bare `TableColumn` annotation. Measured before the shape was chosen: a bare annotation
raises no error at all here, because TypeScript's excess-property check exempts properties
that arrive through a spread — it would have type-checked the boundary without enforcing it.
