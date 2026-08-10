---
"@object-ui/app-shell": patch
---

metadata-admin: an unresolvable visibility-predicate path now fails OPEN, loudly (objectstack#6936)

`views/metadata-admin/predicate.ts` promised fail-open in its own header — "on any
parse error → returns `true`: better to show a field than to silently hide it" —
and delivered it only for *thrown* errors. A path whose root identifier did not
exist in the evaluation scope took a quieter route: `resolveValue` returned
`undefined`, and then every comparison judged it false —
`['text','number'].includes(undefined)`, `undefined === 'text'` — so a predicate
referencing a name that is not there **hid** the field. Fail-CLOSED, the opposite
of the documented promise, with nothing in the console.

The bite case is a version-skew window, measured in objectui#3923: `@objectstack/spec`
≤ 17.0.0-rc.5 spells the `objectForm` sub-field predicates bare (`type in ['text',…]`,
16 of them) while this engine evaluates them against a `{ data: draftRow }` scope. A
console upgraded ahead of its backend resolved `type` to nothing, and all 16
type-conditional Studio sub-fields — Min / Max / Precision / Scale / Max Length /
Min Length / reference / deleteBehavior / expression / returnType /
autonumberFormat / language … — disappeared for every row type at once. The symptom
users saw was "the config items are gone", indistinguishable from a permission
problem or an unsupported field type.

Per the maintainer ruling on objectstack#6936 (option C):

- **An unresolvable path evaluates `true`.** The field stays visible instead of
  vanishing, honouring what the header always claimed.
- **Dev mode says so**, naming the unresolved path *and* the predicate that
  carried it, warn-once per (path, predicate) pair — the shape
  `warnOnUnknownActionKeys` established in `@object-ui/core`. Keying the memo on
  the path alone would have reported the first of the 16 skewed predicates and
  stayed silent about the other fifteen.

**The boundary, which is the load-bearing half.** "Unresolvable" means the path's
ROOT identifier is not a name the scope declares (`type`, `record.status`,
`page.selectedId` against a scope whose only name is `data`). It does *not* mean
"the value came out undefined": `data.type == 'text'` on a draft that has no
`type` yet resolves its root fine, the draft simply carries no value there — that
comparison is still false and the field stays hidden, silently, exactly as before.
A draft is allowed to be empty; widening fail-open to any absent value would light
up every type-conditional sub-field at once on a fresh row. A typo one segment
deep (`data.tpye`) is indistinguishable from an unfilled draft field *without the
schema*, which this evaluator does not have — catching that belongs to
publish-time validation of predicate path references at the producer (filed
separately), not to a renderer heuristic (Commandment #0.1).

The signal is a thrown internal error, deliberately not a sentinel value: fail-open
is a property of the whole predicate, not of the sub-expression that failed. A
sentinel would have to be threaded through `!`, `&&`, `||`, `in` and `==` by hand,
and the first operator that missed it would invert the verdict — `!unresolvedPath`
would resolve the inner path to "true-ish" and negate it straight back to false,
i.e. fail-CLOSED again by another route. Throwing routes every failure to the one
fail-open gate that already existed; `!unresolvedPath` is pinned true.

Unchanged, and pinned: the pre-existing parse-error fail-open (still silent — the
path resolved, reading it blew up, a different fact); CEL-order absorption, where
`false && unresolvable` is false and `true || unresolvable` is true with no
warning because the unresolvable half was short-circuited away; and CEL-style loose
nullish equality (`data.type == null` on an empty draft is still true).
