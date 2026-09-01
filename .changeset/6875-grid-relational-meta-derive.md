---
'@object-ui/plugin-grid': patch
'@object-ui/plugin-dashboard': patch
---

A lookup cell in `ObjectGrid` now honours the author's `displayField`
(objectui#6875).

`ObjectGrid` copies a set of relational keys off the object-schema field def
onto each column's `fieldMeta`, and that bag is what the lookup cell renderer
and the inline picker receive. The set was hand-kept and had become a strict
SUBSET of what those two consumers read — `displayField`, `descriptionField`
and `lookupColumns` were read on the grid's own path and never copied.

They are the spellings that matter. `@objectstack/spec` 17.2.0's `FieldSchema`
is strict and declares `displayField` / `descriptionField` / `lookupColumns` /
`lookupFilters` / `reference`, and none of the snake_case twins the copy set
mostly carried — those parse to `unrecognized_keys`, so a spec-compliant
producer cannot emit them. Nothing renames anything on the way in either: the
adapter's `getObjectSchema` choke point rewrites only the `reference` ⇄
`reference_to` pair. So an author who declared `displayField: 'project_code'`
got a grid cell showing the referenced record's generic `.name` instead.

- The copy set is now DERIVED, in `plugin-grid/src/relationalMetaKeys.ts`, from
  a table that classifies every key the consumers read off this bag. A gate
  re-extracts that read set from the consumer sources on each run and fails on
  any unclassified spelling or orphan, so the two cannot drift apart again.
- `reference_field` and `lookup_columns` — the other two never-copied keys —
  stay out on purpose: `FieldSchema` declares neither, so no producer can fill
  them. The gate proves that against the installed spec rather than asserting it
  in prose.
- `plugin-dashboard`'s `CELL_RELATIONAL_META_KEYS` had the same omission in the
  same fallback chain and gains `displayField` too.
