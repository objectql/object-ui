---
'@object-ui/cli': minor
---

`objectui check` judges a file's `type` only when the file says it is an ObjectUI schema, and reports how many it declined to judge.

A root `type` was treated as a component key wherever it appeared. `type` heads at
least seven unrelated JSON vocabularies, and the most common of them is
`package.json`'s `"type": "module"` — so the first line a user saw running
`objectui check` in their own project was a warning about their own package
manifest. Measured at this repository's root: 46 warnings, 45 of them
`package.json` (objectui#5127).

A file now enters type judgement only when it positively reads as an ObjectUI
schema — it declares `"$schema"` pointing at an `objectui.org` URL, or it carries
a structural key from `BaseSchema` (`children`, `body`, `className`,
`placeholder`, `style`, the `visible`/`hidden`/`disabled` predicate family,
`testId`, `ariaLabel`). Every other root-`type` vocabulary — JSON Schema's
`"array"`, an `.eslintrc.json`'s `"commonjs"`, a package manifest's `"module"` —
is simply never judged. The `$schema` match is on the URL's host rather than a
literal string, so a lookalike origin is not accepted and the canonical spelling
can be confirmed without invalidating files that already declare it.

A list of filenames to exclude was the alternative and was rejected: it is a
second hand-maintained list of the shape objectui#5115 had just finished
deleting, and it can only ever enumerate the foreign vocabularies someone already
thought of. This is producer-side declaration instead.

Because the marker narrows what is checked, the command now also reports the
count of files that had a root `type` and no marker, with the `$schema` line that
opts one back in. That number is the coverage this gate gives up until schema
files declare themselves, and printing it is what keeps the loss visible rather
than silent. The `.yaml`/`.yml` half of the scan is unchanged — it was never
type-judged, before this change or after it. Exit codes are untouched: a JSON
parse failure remains the only thing that fails the run.
