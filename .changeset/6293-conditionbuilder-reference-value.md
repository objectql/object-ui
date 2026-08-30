---
'@object-ui/app-shell': patch
---

`ConditionBuilder`'s row mode now compiles a value that is plainly a **reference** as one,
instead of quoting it into a string literal (objectui#6293).

`fmtValue` quoted anything that was not a number / `true` / `false` / `null`, and the value
box is free text — so an author building "this field differs from its prior value", the idiom
that *defines* a change-detection predicate, got `previous == 'previous.status'`. That is
syntactically valid CEL, `previous` is a declared root, and a string literal's contents are
deliberately not scanned for references by `flow-ref-check` or by the server-side validator.
The predicate parsed, registered, evaluated — and was always false, with no author-time signal
at any layer, at all five surfaces that mount this builder.

A value matching a **declared root prefix** now emits as the reference: `record`, `previous`,
`parent`, `user`, `current_user`, `org`. That set is this builder's own vocabulary — `record`
/ `user` / `org` are exactly what its subject dropdown offers one control to the left,
`previous` and `parent` are bound by `evalFieldPredicate` and by the server-side hook /
validation evaluators, and `current_user` is the ADR-0068 spelling of the same identity object
`user` names. Roots this builder never offers (`data`, `os`, `app`, `features`, `input`,
`vars`, `page`) are deliberately excluded: `data.csv` is a plausible literal and `data` *is*
bound, so capturing it would trade one silently-false predicate for another rather than for a
loud one. Declaring which roots a mounting surface actually binds is caller-supplied
vocabulary and belongs to objectui#6296.

The test is "a dotted path under a declared root", not "contains a dot" — a version string
(`1.2.3`), a filename, and a path under an unbound root all stay literal text. The literal and
number controls are unchanged: `done` still compiles to `'done'`, `42` still to `42`.

**Nothing already stored is rewritten.** A persisted `previous == 'previous.status'` no longer
round-trips byte-for-byte, so the builder's existing safety rule hands it to the raw CEL editor
rather than reinterpreting it — the author sees both readings and decides. In the other
direction a hand-authored `record.status != previous.status` now round-trips *into* the row
builder, which it could not before.

The repair is at the authoring surface, where the ambiguity is: no consumer-side tolerance is
added, and the emitted reference is now an identifier the existing reference checkers can see,
where a string literal's contents were invisible to them.
