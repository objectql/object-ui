---
"@object-ui/types": patch
---

refactor(types): bind seven spec-named symbols to the spec instead of re-declaring them — objectstack#4115 ledger burn-down

The `check-spec-symbol-derivation` ledger opened at **156** untriaged collisions.
This is the first tranche: **149** remain, and every symbol removed was *proved*
equivalent to the spec's before being replaced, not assumed equivalent because
its doc comment said so. Four of the seven carried exactly such a comment —
"Mirrors the server's `ImportWriteMode` (`@objectstack/spec`)", "(ObjectStack
Spec v2.0.1)" — which is the claim this issue exists to make true.

Bound as re-exports (`@objectstack/spec/api`, `/kernel`, `/ui`):
`BreakpointName`, `ExportJobStatus`, `ImportJobStatus`, `ImportWriteMode`,
`ValidationError`.

Derived with `z.infer` (`@objectstack/spec/data`): `JoinStrategy`,
`WindowFunction` — the spec exports these as zod enums rather than as types, so
a re-export would not compile against them.

All seven are structurally unchanged, so no consumer changes: the full repo
type-check passes 76/76.

**What decided the tranche.** Mutual assignability (`[Local] extends [Spec]` and
back) looks like the obvious test for "is this a safe re-export", and it lies in
three ways, all of them present in this repo:

- The **spec's own** export resolves to `any` — `NavigationItem`, `JoinNode`,
  `FormField`. Binding these would replace a precise local interface with `any`,
  a type-safety regression wearing a burn-down's clothes. A naive probe reports
  them as "identical to the spec" and recommends exactly the wrong edit.
- The **local** declaration resolves to `any` — recursive zod schemas annotated
  `z.ZodType<any>` (`FilterConditionSchema`, `NavigationItemSchema`).
- The local declaration carries `[key: string]: any` — the objectstack#4075
  mechanism, which absorbs any extra member so two types compare equal while
  accepting wildly different objects (`FormField`, `AppSchema`, `PageSchema`,
  `ThemeSchema`, and 12 more).

A zod schema needs one question more than a type does: `FormFieldSchema` has an
**identical `_output` and a divergent `_input`**, so re-exporting it would have
silently changed what authoring input parses. All of this is now written into the
ledger's burn-down instructions, with the detection probe for each case.

`spec-derived-unions.test.ts` gains an **inverted pin** for the three spec-side
`any` cases: it asserts they are *still* `any`. The day the spec types any of
them properly the assertion stops compiling, and the failure is the instruction
to re-run the triage and burn that symbol down.

**Guard fix:** `referencesSpec` walked the declaration's own name node, so a
symbol whose name was also bound to a spec import counted as derived from
itself. TypeScript rejects that particular pair as a duplicate identifier, so it
was not reachable in compiling code — but a guard that depends on the compiler
having run first is a guard with a hole in it. The clean-tree result is
unchanged, confirming it was masking nothing.
