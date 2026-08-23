---
'@object-ui/plugin-dashboard': patch
---

`plugin-dashboard`'s two private copies of the reference-bearing field family now
read `@object-ui/core`'s published `EXPANDABLE_FIELD_TYPES` instead of restating
it — `LOOKUP_TYPES` in `recordFields.tsx` and the inline disjunction inside
`computeLookupExpand` in `ObjectDataTable.tsx`. Both carry the identity pin the
already-converged consumers carry, so a member-identical private copy fails
rather than quietly re-forking the table.

Two behaviour changes on the dashboard table's `$expand`, in opposite directions:

- **A `tree` column is now expanded.** A self-referencing hierarchy field is
  reference-bearing and a member of the shared family, so its cell renders the
  parent record's display name instead of a bare id — the same treatment the form
  and grid roads already gave it.
- **A `reference`-typed column is no longer expanded.** Measured before removing
  it: `reference` is absent from `@objectstack/spec`'s closed `FieldType`
  vocabulary and is refused by `FieldSchema.safeParse`, so no spec-compliant
  object schema can declare a field whose stored type is `reference`. Dropping it
  is a no-op on real data; the spelling is a legacy dialect alias on the
  action-param surface, folded to `lookup` before any field-type data is read.

`EXPANDABLE_FIELD_TYPES` itself is unchanged — the measurement did not license
widening a published shared set.
