---
'@object-ui/plugin-detail': minor
---

`record:alert` binds the row through `usePredicateRecordContext`, so an
author-declared `properties.visible` is actually consulted.

`renderers/record-alert.tsx` was the last predicate face in the repo still
handing `useCondition` a root-only `{ record }` bag. Every other row-scoped
predicate — the four generic action renderers (objectui#4075) and app-shell's
`DeclaredActionsBar` (objectui#4077) — binds the row through the shared
`usePredicateRecordContext(record)` helper, which resolves the three spellings
objectui#5330 ruled on: canonical `record.status`, the deprecated row-action
shorthand `status`, and deprecated legacy `data.status`.

Under the root-only bag only the canonical spelling worked, and the two others
failed in **opposite** directions — both of them silently, because this call
site is fail-soft:

- **row-action shorthand** (`status == 'x'`) resolved nothing, so the evaluator
  threw. The legacy `${…}` path answers a throw with its own source text, a
  non-empty and therefore truthy string, so the verdict was **SHOWN on every
  row**. A banner the author had gated was permanently on screen.
- **legacy `data.*`** (`data.status == 'x'`) did not throw at all. App-shell's
  ambient predicate scope (`providers/ExpressionProvider.tsx`) carries
  `data: {}`, so the predicate read that object instead of the row, compared
  `undefined`, and the verdict was a constant false — **never shown**.

**Behaviour change, stated plainly:** a shipped `record:alert` whose `visible`
was written in either deprecated spelling was inert and is now live. A banner
that was permanently visible may begin to hide, and one that never appeared may
begin to show — that is the point of the fix, but it is a verdict change rather
than a no-op. Canonical `record.*` predicates are unaffected in verdict: they
resolved before and resolve now, pinned on both polarities. An in-tree census
found no `record:alert` `visible` predicate outside this package's own tests.

A node-level `visibleWhen` is a separate gate one tier up in `SchemaRenderer`,
with its own deliberate bindings (`data` is the data-source adapter there, not
the row). This change does not touch it; the two still compose as AND.

The renderer's header comment described the shared-scope behaviour it did not
have. It now describes what the file does, including the fail-soft policy and
the two-gate composition.
