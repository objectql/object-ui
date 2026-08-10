---
"@object-ui/core": patch
---

`evalRowPredicate`: the fail-closed report now names the engine's failure reason, and the ROW always wins over host scope (objectui#3792, objectui#3796)

Two defects in one function, `packages/core/src/evaluator/listConditional.ts`,
shared by every surface that gates on a row predicate: the row kebab, the bulk
selection bar, kanban conditional formatting, and — since objectui#3521 — the
record page header.

**The safest path said the least (objectui#3792).** `evalRowPredicate` has two
diagnostic routes, and their information content was inverted. The single-eval
fast route lets the canonical helper warn, so it prints the engine's own reason
(`Reason: [runtime] No such key: owner_id`). The `warnOnError: true` route — the
fail-CLOSED one, taken by every caller that makes a button disappear — runs
`evalFieldPredicate` twice with `{ warn: false }` to tell a fault from a genuine
`false`, and that silence discarded the reason along with the duplicate warning.
So the more decisively a surface hid a control, the less it said about why: the
console line named the predicate but not the defect, and `No such key: owner_id`
or `no such overload: string == null` is usually the whole answer.

`FieldPredicateDiagnostic` gains an optional `onFault(reason)` passback:
`evalFieldPredicate` hands out the engine's verbatim text (kind tag, message and
source excerpt — the exact string it prints after `Reason:`) even when its own
warning is suppressed. It fires per fault, deliberately independent of the
once-per-predicate warning dedupe, so a caller doing its own warn-once
bookkeeping keeps control of it; the verdict is unaffected, and callers that pass
nothing are unchanged. `evalRowPredicate` threads that reason into its labelled
warning, and the legacy-dialect route does the same with the message its engine
throws (`Reason: [legacy] …`), so both dialect paths report a fault the same way.
Warn-once semantics are unchanged — the reason is deliberately not part of the
dedupe key.

**Wording: not a list function, and not for a long time.** The same message
called every caller a "**list** conditional predicate". A hidden button on a
record page header reporting "a list conditional predicate" sends its author to
the list view to look for a control that was never there. Both messages this
module emits (evaluation failure and the legacy-dialect deprecation) now read
"conditional predicate".

**The row is the subject — on both dialect paths (objectui#3796).** The scope
merge pinned `data` after the host-scope spread but not `record`, leaving
`record` to each engine's own binding — and the two engines disagreed. The legacy
evaluator re-pinned `record` to the row (row won); the CEL engine takes its
`extra` bag over its `record` binding, so a host scope carrying a `record` key
won there instead. One function, one predicate text, two subjects — selected by
whether the string happens to contain `===` or `${…}`, the dialect-routing
markers, which no author picks deliberately. `record` is now pinned after the
spread exactly as `data` is, which fixes both paths at the merge site rather than
relying on either engine's precedence.

No host injects a `record` key today — `ExpressionProvider` binds
`current_user` / `user` / `ctx` / `os` / `app` / `data` / `features` — so nothing
observable changes for existing apps; this closes the edge before a host adds one
(`ctx.record` already exists, which is exactly how it would arrive). A row FIELD
named `record` is likewise no longer able to become the row root; it stays
addressable as `data.record`.

Shipped as a patch: no new exported symbol, one optional field added to an
already-exported options interface, and no existing call signature changed.
