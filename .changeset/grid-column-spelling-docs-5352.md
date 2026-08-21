---
---

Docs and skills only — this publishes nothing, declared explicitly with an empty
frontmatter rather than left undeclared. No package `src/` is touched, so no
`@object-ui/*` package changes behaviour and there is nothing here for a consumer
to upgrade to.

Corrects the two published corpora that taught `object-grid` columns in a `name`
spelling `ObjectGrid` does not read. `ListColumnSchema` (`@objectstack/spec/ui`) is a
strict object whose column-identity key is `field`; `{ "name": ... }` is refused by
name (`unrecognized_keys: ["name"]`) and, at runtime, contributes no column.

- `content/docs/api/schema-reference.md` — the `ObjectGridSchema` example authored a
  MIXED array (four bare strings followed by one column object). Two defects in one
  array: the object entry spelled `name`, and mixing forms is itself unsupported —
  `normalizeColumns` dispatches the whole array on `columns[0]`, so a column object
  standing behind a bare string is dropped whatever it spells. Renaming the key alone
  does not fix it; the example is now uniformly `ListColumn` objects. The `columns`
  row of the property table now names `field` and states the no-mixing rule.
- `skills/objectui/guides/page-builder.md` — the grid example's three columns were
  all-object in the `name` spelling, so the grid rendered its row-number column and no
  data columns at all. Now spelled `field`. A note was added between the grid and form
  examples, which sit adjacent and mean the OPPOSITE thing by the same pair of words:
  `ListColumn.field` names the object field a column shows, while `FormField.name`
  names the field a form input writes. That adjacency is the documented cause of this
  defect family (`packages/core/src/utils/column-identity.ts`).

The adjacent `object-form` example is unchanged and was never wrong — `FormField.name`
is that layer's real key.
