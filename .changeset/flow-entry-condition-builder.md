---
'@object-ui/app-shell': minor
---

flow designer: the Start node's **Entry condition** now opens in the row-based
condition builder, with raw CEL one click away as the escape hatch (objectui#6226).

The builder is given the trigger record's own vocabulary — bare field names and
`previous.<field>`, resolved by `flow-scope.ts` — rather than the record-scoped
default its five other consumers use, so the subjects it offers are the spelling
this surface evaluates and teaches. 15 of the 17 entry conditions shipped in the
example apps now open as structured rows; the remaining two mix `&&` with a
parenthesised `||` group, which is a grammar limit of the row model and keeps
them on raw mode by design.

Compiled output is unchanged: the same CEL the runtime already evaluates, in the
author's own quoting. The legacy `criteria` key, a schedule/manual/webhook
trigger (which binds no record), and every other `expression`-kind flow field
keep the single-line input they render today — the builder is opt-in per field
descriptor and requires a declared vocabulary, never inferred.
