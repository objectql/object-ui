---
'@object-ui/types': minor
'@object-ui/components': minor
---

Split the static `table` column type off the rich shared `TableColumn`
(objectui#5474, maintainer ruling 2026-08-22: Option C), so declared =
enforced holds per renderer.

`TableColumn` is unchanged and remains the rich shape `data-table`,
`CRUDSchema` and detail-view relations honour. The static `table` renderer's
`TableSchema.columns` now declares the new narrow `StaticTableColumn`
(`header`, `accessorKey`, `className`, `cellClassName`, `width` — exactly the
keys that renderer reads). The eleven keys the static renderer never read are
retired from its surface as ADR-0049 tombstones: `hoverable` / `striped` on
`TableSchema`, and `minWidth` / `align` / `fixed` / `type` / `sortable` /
`filterable` / `resizable` / `editable` / `cell` on its columns.

Breaking for authored metadata that wrote those keys on a `type: 'table'`
node: they were silently inert before and are now refused loudly — a tsc
error on the interface (`?: never`) and a parse rejection naming the key in
`@object-ui/types/zod`. That loud refusal is the ruled outcome. Migration:
nodes that wanted the interactive behaviour move to `type: 'data-table'`
(whose columns keep the rich `TableColumn`); right-aligned columns on the
static table use `cellClassName: 'text-right'`; alternate-row styling uses
Tailwind on `className`.
