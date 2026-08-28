---
'@object-ui/cli': minor
---

`objectui check` judges a file's `type` only when the file is recognisable as an ObjectUI schema, and reports how many it declined to judge.

A root `type` was treated as a component key wherever it appeared. `type` heads at
least seven unrelated JSON vocabularies, and the most common of them is
`package.json`'s `"type": "module"` — so the first line a user saw running
`objectui check` in their own project was a warning about their own package
manifest. Measured at this repository's root: 46 warnings, 45 of them
`package.json` (objectui#5127).

A file now enters type judgement only when its root carries a structural key
declared on `BaseSchema` — `children`, `body`, `className`, `placeholder`,
`style`, the `visible`/`hidden`/`disabled` predicate family, `testId`,
`ariaLabel`. Every other root-`type` vocabulary — JSON Schema's `"array"`, an
`.eslintrc.json`'s `"commonjs"`, a package manifest's `"module"` — is simply
never judged. The key set is read out of the node contract rather than invented,
and it is closed: it grows only when `BaseSchema` grows.

A list of filenames to exclude was the alternative and was rejected: it is a
second hand-maintained list of the shape objectui#5115 had just finished
deleting, and it can only ever enumerate the foreign vocabularies someone already
thought of. This is a positive marker instead.

Because the marker narrows what is checked, the command now also reports the
count of files that had a root `type` and no marker, together with the marker
keys that opt one back in. That number is the coverage this gate gives up until
schema files are recognisable, and printing it is what keeps the loss visible
rather than silent. The `.yaml`/`.yml` half of the scan is unchanged — it was
never type-judged, before this change or after it. Exit codes are untouched: a
JSON parse failure remains the only thing that fails the run.

No public `$schema` URL is introduced. An earlier revision also admitted a file
whose root `$schema` had an `objectui.org` host; the maintainer ruled against
minting that identifier (2026-08-20, objectui#5127), so the structural key is the
only marker. Because the matching was host-based rather than literal, that arm
can be added later without invalidating a single file.
