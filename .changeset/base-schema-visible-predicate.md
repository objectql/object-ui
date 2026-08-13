---
'@object-ui/types': minor
---

`BaseSchema.visible` accepts the predicate string the renderer evaluates

`visible` was declared `boolean`, but the renderer never read it as one: it
evaluates the key — `SchemaRenderer.tsx:382` calls
`evaluator.evaluateCondition(schema.visible)`, and `evaluateCondition` is
declared `(condition: string | boolean | undefined, context?) => boolean`. The
sibling keys `visibleWhen` and the deprecated `visibleOn` are `string` for that
same reason; `visible` simply under-reported a capability it already had, and
fixtures exercising it had to cast past the declaration.

Now `boolean | string` — exactly what the evaluator accepts, no wider.

Graded **minor** by position analysis of the published `.d.ts`: the only diff is
`visible?: boolean` becoming `visible?: boolean | string` on an
authored-input-dominant property, with no union member removed and no other
declaration touched — the same shape as #4586/#4591. Authors gain a spelling;
nothing that previously type-checked stops doing so. Code that READS
`schema.visible` was already coping with `any` through `BaseSchema`'s index
signature.
