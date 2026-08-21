---
'@object-ui/components': patch
---

The `[page:header]` sparse-predicate warning no longer blames `hidden: true` — it
states what it actually measured (objectui#5399).

When an action's `visible` predicate references a `record.<key>` the bound payload
does not carry, the warner names the missing key and then explained the cause:

> Hidden (hidden: true) fields are stripped from detail payloads server-side, so a
> predicate gating on one may evaluate to a hide-by-default verdict.

That cause is false, and it names a mechanism this repo does not own. `hidden` is a
UI concern — the framework spec describes it as "Hidden from default UI"
(`packages/spec/src/data/field.zod.ts`) — not a projection rule. Confirmed against
the framework checkout rather than taken on trust: ObjectQL's own strip for the
`__search` companion documents that the `hidden` / `readonly` / `system` markers are
"None of them is a PROJECTION rule", which is precisely why a dedicated strip rule
had to be written for that one column; drivers answer a query with no `fields` using
`SELECT *`; and `metadata-protocol` enumerates what the read path does drop —
`internal: true` columns and the `__search` companion, and nothing else. The only two
read-side uses of `field.hidden` in the framework are auto-view/auto-form column
generation and companion-source eligibility, neither of which removes a key from a
record body.

So an author who read this diagnostic went hunting for a `hidden` flag they would
either not find, or find on a field the payload demonstrably still returns — while
the real source of the sparseness (a projected or partial read) went unexamined. A
confidently wrong cause in a diagnostic is worse than no cause, because it is
actionable in the wrong direction.

The replacement states the fact this surface can actually see and the consequence it
does own: the page bound a payload without those keys, a projected or partial read
will not carry them, and the predicate therefore fails closed and hides the action.
The measured half of the message — action name, missing fields, predicate source —
is unchanged, and nothing about what triggers the warning changed.

Message text only. The same false claim also sat in this warner's own doc comments
and in the comments of the test that pins the message; both are corrected here, and
the docstring now carries an explicit note against re-attributing the cause to
`hidden: true`. No other call site was swept.
