---
"@object-ui/app-shell": patch
---

fix(SchemaForm): render row sub-fields for `repeater` fields whose schema is a union (objectui#3379)

In Edit View Config → Columns & Filters → Sort, "Add" produced an empty row
with no field picker or order dropdown. A View's `sort` prop is a
`z.union([z.string(), z.array(z.object({ field, order }))])`, so its JSONSchema
is `anyOf: [string, {field,order}[]]`. The SchemaForm repeater read
`schema.items` at the top level — which is `undefined` for a union — and
derived zero sub-fields.

The repeater now resolves the union to its array branch and uses that branch's
`items` for both the derived field list and the per-row controls
(`pickSubSchema`). The legacy bare-string `sort` form remains valid in the spec
(its removal is a separate, deferred deprecation cycle); this is purely a
renderer fix.
