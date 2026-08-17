---
'@object-ui/components': patch
---

`FilterBuilder` settles a row's **value** when its field changes, instead of leaving a value the new column's input cannot show.

objectui#4768 / PR #4779 settled the row's operator on a field switch and
re-shaped the value only when the operator's family changed — scalar to scalar
has no shape question, so what the user typed was carried through on purpose.
But the field's **type** changed too, and the value input is redrawn from it: a
browser renders a non-numeric value in `<input type="number">` as **blank**. A
`text` row filtered `equals "acme"`, pointed at a number column, showed an empty
box while the row went on carrying `"acme"` — `foldFilterGroupToSpecRules`
persisted it and the live grid queried `amount equals "acme"`. The same
invisible-value shape as objectui#4768, one column over.

Changing the field is now one edit with the operator, the value's shape **and**
the value's type. Convertible values are carried, the rest clear to the family's
empty shape (scalar `''`, list `[]`, range `[]`):

- `"42"` on a number column becomes the number `42`; `"acme"`, `"42abc"` and
  `"1,000"` clear. The reading is deliberately stricter than `parseFloat`, which
  would turn `"acme"` into `0` — a filter the user never wrote;
- `"true"` / `"false"` convert on a boolean column, and a boolean becomes
  `"true"` / `"false"` on a text column, so the round trip closes; `1` and
  `"yes"` are conventions rather than readings, and clear;
- date-like columns take only what their own input can render, plus the one
  truncation that loses nothing it could have shown (`"2024-03-05T14:30"` →
  `"2024-03-05"` on a date column). A bare date does **not** gain a midnight to
  fit a `datetime` column: `equals 2024-03-05T00:00` is a filter that looks
  answered and matches almost nothing;
- a value the new column can already hold is left alone — switching between two
  text columns, or two numeric ones, still keeps what the user typed, and an
  unfilled row stays unfilled.

The convertibility judgement is defined once, next to `reshapeFilterValue`,
and `getInputType` now reads the same family table it does — so the type a value
is converted **to** and the input it is edited **in** cannot drift apart.
