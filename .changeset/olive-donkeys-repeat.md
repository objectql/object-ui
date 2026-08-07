---
"@object-ui/app-shell": patch
---

metadata-admin: name the offending column when `config.columns` is rejected

`config.columns` is `string[] | ColumnDef[]` — a union with no discriminant — so
Zod reported every rejection as one collapsed issue on the field itself:
`config.columns` / `Invalid input`, on the create gate and the edit gate alike.
The field was reachable, but nothing said which column was wrong, which key, or
what was expected.

The union member is now chosen by the value's own first element — a list of
field names or a list of column objects — and that member's real diagnostics are
reported at their draft-absolute path. A mis-typed key reports
`config.columns.0.field` with `expected string, received number`; a stray number
in a list of field names reports the element that broke it rather than every
element of the shape the author never chose. The aggregated container reaches
the same union as `list.columns.…`, and both gates now report identically.

Only unions that really are "an array of A or an array of B" are read this way,
so neighbours such as `config.sort` (`string | ColumnSort[]`) are untouched.
Where the content elects nothing — a first element that is neither a string nor
an object — the previous message is kept rather than guessing.

Validation verdicts are unchanged: the accept/reject decision is still made by
the one gate, and this only changes how an already-failed draft is presented.
