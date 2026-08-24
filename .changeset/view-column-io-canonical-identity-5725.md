---
'@object-ui/app-shell': minor
---

The metadata designer's View **column list** now reads a column's identity —
row label and bound field name — in the ObjectStack canonical spelling only:
`field` and `label`. The legacy TanStack aliases `accessorKey` / `header` are no
longer consulted (objectui#5725). This is the editor-side half of the read
objectui#5344 retired in the column inspector one file over; the two surfaces
render inside the **same panel** and until now gave the author two different
answers about what a column is called.

Why this is a behaviour change and not a tidy-up: `ListColumn` refuses both
legacy keys by name (`unrecognized_keys`), so a column carrying them has no
field key and no label the spec recognises. Two consequences the list surface
had that the inspector did not:

- **The label chain was inverted, not merely tolerant.** It read
  `label ?? header ?? field ?? accessorKey`, preferring the undeclared `header`
  **over** the declared `field`. A perfectly canonical column that also carried
  a stray `header` key displayed the alias' value *instead of* its own declared
  identity.
- **The field-name read backs more than a label.** It feeds `usedFieldNames()`,
  which the Add-field picker consults, so a spec-refused column reserved a field
  name and the picker tagged that field "Added" — for a column no accepted
  document actually binds.

**What an author sees:** a stored column shaped `{ accessorKey, header }` is now
named positionally in the list (`col 1`) rather than by its refused spelling,
and the row stays selectable exactly as before — the positional fallback already
existed at the end of that chain. The Add-field picker no longer reports such a
column's field name as taken. Canonical `{ field, label }` columns and
bare-string columns are untouched, and a declared `label` / `field` now outranks
any stray alias beside it.

**What is deliberately NOT changed:** the write path. These helpers still
reorder and splice the raw `columns` array without normalising it, so no stored
document is rewritten by the act of viewing or editing it — the same fence
objectui#5344 held.
