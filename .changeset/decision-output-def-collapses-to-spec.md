---
"@object-ui/app-shell": patch
---

Collapse app-shell's `DecisionOutputDef` to a plain re-export of the spec's
(objectstack#4562).

The local type was `interface DecisionOutputDef extends SpecDecisionOutputDef
{ required?: boolean }` — a structural derivation carrying ONE documented
divergence, because the server enforced `required` (`decide()` rejects a blank
required output before any write) while `@objectstack/spec` did not model it.
The spec adopted `required` in cd6b9f202 and pinned it at the schema level in
objectstack#4561, and this repo now resolves a spec that has it
(`@objectstack/spec@17.0.0-rc.1`, #3178). The addition is therefore redundant
and the type becomes `export type DecisionOutputDef = SpecDecisionOutputDef`.

No behavior change and no API change: the symbol is internal to this package
(it is not re-exported from `src/index.ts`), the resolved shape is identical
key-for-key, and `decisionOutputParams()` still reads `d.required` — now off
the spec's own field.

The module TSDoc still asserted "the spec does not model it yet", which was
stale and actively misleading — an agent reading it would take the divergence
as ground truth and build on it, which is the objectstack#4115 failure class
this file's own tripwires exist to prevent. It now states the current truth.

The parity pin in `__tests__/spec-symbol-parity.test.ts` is inverted
accordingly: `Exclude<keyof DecisionOutputDef, keyof SpecDecisionOutputDef>`
is asserted `never` rather than `'required'`, plus an exact-identity
assertion, so a future local addition to this symbol cannot slip in
undocumented. The `type`-is-the-spec's-closed-enum pin is unchanged — that
narrowing is still what stops a typo'd picker kind from silently degrading to
a raw record-id text box (objectui#2955).

Note that this pin, like every other type-level assertion in that file, is not
yet compiled by any gate — package tsconfigs exclude `**/*.test.ts`, so
nothing type-checks it. It was verified by compiling the file explicitly. See
objectui#3181.
