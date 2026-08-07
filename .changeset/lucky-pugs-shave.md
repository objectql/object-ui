---
"@object-ui/app-shell": patch
---

metadata-admin: name the offending key when only one union member ever read the value

A union with no discriminant reports its failure as one collapsed issue, and the
member diagnostics that would name the problem are buried inside it. PR #3677
started unpacking those for `config.columns` by reading the value's own content,
but deliberately declined every union where some member had rejected the value's
type outright — which left `config.sort` (`string | ColumnSort[]`) collapsed even
though only one of its two members had read the value at all.

When exactly one member accepted the value's type, naming it is a fact rather
than a preference: it is the only member whose complaint can be about what the
author wrote. So `sort: [{ field: 'n', order: 'bogus' }]` now reports
`config.sort.0.order` with the spec's own `expected one of "asc" | "desc"`
instead of `config.sort` / `Invalid input`, and the same holds for a sort row
that is not an object, a `columns[].summary` written as a bad enum string, a form
`sections[].fields[]` entry missing its `field`, and an array `filter[].value`
whose offending element is now addressed directly.

Where two or more members read the value, or where none did, nothing changes:
the previous message is kept rather than inventing a preference between members
that objected equally. Both gates — create and edit — continue to report
identically, and validation verdicts are untouched: the accept/reject decision is
still made by the one gate, and this only changes how an already-failed draft is
presented.
