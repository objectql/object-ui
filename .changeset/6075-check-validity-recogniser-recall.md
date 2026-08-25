---
'@object-ui/cli': minor
---

`objectui check` recognises a schema by validating it, and reports broken ObjectUI files instead of filing them as foreign ones.

A file with a root `type` was judged only when its root carried an ObjectUI
structural key (`children`, `body`, `className`, …). Leaf schemas carry only
their own vocabulary, so nothing checked them: measured on this repository, 475
files were eligible, 166 were judged and 309 were skipped.

The command now has a second recogniser arm — the document validates as an
ObjectUI component schema under `@object-ui/types`' own Zod union — which the
maintainer's 2026-08-25 ruling selected over shipping a JSON Schema artifact to
point a `$schema` URL at. It admits 209 of those 309 files. The structural arm
still runs first, so recognition costs nothing for files that already had a
marker, and `package.json` is still never judged: `"type": "module"` names no
component the protocol models.

Validity alone would have answered two different questions with one word.
A broken ObjectUI schema fails validation exactly as a foreign file does, so a
two-bucket report would have filed it as "not ObjectUI" — and the symptom of
that is an absence: the file simply stops being mentioned. Measured, that bucket
is not empty: 54 files land in it and 53 of them are real corpus content.

So files the recogniser refuses are split. When the root `type` names a
component this build registers, the file is **listed by name** as ObjectUI
content that did not validate, pointing at `objectui validate <file>` for the
reason — either the document is off-spec or its component type is not modelled
by `@object-ui/types`. Everything else is counted as skipped, as before. The
printed explanation now describes both arms, and only unreadable JSON still
makes the command exit non-zero.
