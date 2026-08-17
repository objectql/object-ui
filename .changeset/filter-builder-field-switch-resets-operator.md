---
'@object-ui/components': patch
---

`FilterBuilder` settles a row's operator when its **field** changes, instead of leaving an operator the new field's dropdown does not list.

The operator buckets are per field type and they do not nest: a `select` column
offers `in` / `notIn`, a `text` column offers none of them, and only a date
column offers `between`. Changing a row's field wrote `{ field }` alone, so the
operator survived into a bucket that no longer contained it. Radix's
`SelectValue` matches against the `SelectItem`s actually mounted, so the
operator trigger rendered **blank** — while the row went on filtering by an
operator the user could neither see nor reach, and could only clear by deleting
the row.

Changing the field is now one edit with the operator and the value's shape, the
same way objectui#3958 / PR #4762 made changing the operator one edit with the
value's shape:

- an operator the new field's bucket still offers is **kept** — switching
  `contains` from one text column to another must not silently become `equals`,
  and the value it carries is left alone;
- one the new bucket cannot offer is replaced by that bucket's **first** entry,
  and the row's `value` is then re-shaped for the family it lands in — a list
  under `in` collapses to its first entry under `equals`, a `between` range
  keeps its lower bound, an untouched `[]` becomes `''`.

Membership is decided through the spec's own `normalizeFilterOperator`, the fold
`filterValueArity` already uses, so a stored rule that reaches the builder
spelled `not_in` is recognised as the operator the dropdown lists as `notIn` and
is not reset out from under the author. The fold is injective over this
builder's whole operator vocabulary, which is what makes comparing through it
safe; a test pins that, and fails the day an added operator would break it.
