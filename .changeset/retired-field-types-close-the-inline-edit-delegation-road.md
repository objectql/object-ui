---
'@object-ui/fields': patch
---

Retired field-type spellings can no longer reach an inline editor by delegation — the grid's inline cell editor stops offering a working person picker for `owner`.

objectui#4814 retired the `owner` field type with a loud tombstone, and the
record form has answered `type: 'owner'` with a visible refusal ever since.
`FieldEditWidget` did not participate, and the reason it was missed is that no
routing table had to list the spelling for it to stay alive:
`hasFieldEditWidget` answers `resolveInlineEditType(type) in EDIT_WIDGETS`, and
`resolveInlineEditType` returns a type **unchanged** when it is already a key of
`EDIT_WIDGETS`. So while `owner: UserField` sat in that map, the alias table —
where the retirement lives — was never consulted, and the retirement never
applied. Measured: `hasFieldEditWidget('owner') === true`, and a direct
`FieldEditWidget` call rendered a working person picker. Every host built on
this seam, the data grid's inline cell editor being the user-facing one, still
let a person be picked and saved for a field the record form refuses.

The gate now consults the retirement table itself, so this closes the **class**
rather than the spelling — the next retirement covers this seam the day it lands
in `RETIRED_FIELD_TYPES`, with no edit here:

- `hasFieldEditWidget()` answers `false` for any retired spelling, ahead of
  every table lookup (so it holds even if a retired spelling is still a key of
  the widget map);
- `isInlineExcludedFieldType()` answers `true` for any retired spelling, which
  is what routes a host to its read-only path;
- `FieldEditWidget` itself renders no control for a retired spelling and writes
  the once-per-spelling console prescription naming the migration;
- `owner` is dropped from `EDIT_WIDGETS` and from the cosmetic
  `COMPACT_EDIT_TYPES` sizing set.

The second bullet is load-bearing and not cosmetic. `ObjectGrid` marks a column
`editable: false` exactly when `isFieldInlineEditable` is false, and that
predicate consults `isInlineExcludedFieldType`. Without it, closing the first
gate alone would have left the column editable, handed the cell editor a `null`
widget, and let DataTable fall back to its built-in **plain text input** — which
for a stored person reference displays a coerced value and writes a bare string
straight back over it. Measured before/after on the grid consumer: a stored
`owner` field went from an editable cell rendering the person picker to a
read-only cell (`isFieldInlineEditable('owner')` `true` → `false`), which is the
same disposition `password`, `formula` and `composite` already get, for the same
reason. The read path is unchanged from #4814: the text cell plus the console
prescription.

`user` is untouched — it keeps the person picker, its compact sizing and its
expanded-object value resolution. The record-owner idiom survives verbatim as
`{ type: 'user', name: 'owner' }`: the field NAME carries the ownership meaning,
the type carries the widget.
