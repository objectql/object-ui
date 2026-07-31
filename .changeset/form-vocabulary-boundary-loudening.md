---
"@object-ui/components": patch
"@object-ui/plugin-form": patch
"@object-ui/cli": patch
---

fix(form): a spec-vocabulary field no longer crashes the standalone form, and every surface now says which vocabulary you meant — #3090

Writing the regression test against the unfixed renderer proved the failure
was worse than the assumed silent drop: a `{ field: 'x' }` entry (spec
form-VIEW vocabulary) slipped past the `f?.name` guards into a
react-hook-form Controller with `name === undefined` and crashed the whole
standalone form on `name.split('.')`, with nothing naming the culprit entry.
The renderer now partitions such entries out — the rest of the form renders —
and surfaces them with an inline alert plus a console.error whose text is the
fix instruction (rename to `name`, or use an object-bound form whose sections
accept the spec shape).

`objectui validate` grows the same boundary awareness: on failure, a
`{ field: … }` entry in a standalone form gets a "likely cause" hint naming
the real fix instead of the bare `invalid_union` — the previous message read
as "bolt a `name` on", which converts spec metadata wrongly. On success,
mixed-vocabulary entries (`name` + string `field`) get a warning: they
validate, but the spec key is dead weight the renderer ignores.

`normalizeSectionField` warns (once per site) when an authored section field
mixes both identity keys — the spec branch derives the runtime name from
`field`, so an authored `name` was silently overwritten.
