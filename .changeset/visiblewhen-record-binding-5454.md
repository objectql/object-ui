---
'@object-ui/react': minor
---

Bind `record` into the node-level visibility evaluator, and stop a hoisted
`properties.visible` swallowing a declared `visibleWhen`.

`@objectstack/spec` has declared since ADR-0089 that a page component's
`visibleWhen` binds the row — `ui/page.zod.ts`: *"Binds `record`,
`current_user`, `page.<var>`"*. `SchemaRenderer` bound no `record` at all. Its
evaluator was built from the ambient predicate scope, `data: dataSource` (the
connector **adapter**, not the row) and `page: pageVariables`; the row lives in
`RecordContext`, which that evaluator never read.

Because the surface is fail-soft, a `record.*` predicate did not misfire — it
resolved to **shown**. Both polarities of the same predicate returned the same
verdict, so a visibility gate silently did not gate, on every block on every
record page. Measured on `record:alert`, `record:path`, `page:card` and
`element:text`.

Three changes, all in `SchemaRenderer`'s evaluation memo:

- **`record` is bound**, as the `record` root only — the three roots the
  describe promises and nothing more. Not as bare fields, and never over
  `data`, which is what `${data.*}` in a props bag resolves against. Bound
  conditionally, so "no row" binds nothing rather than shadowing a `record` a
  host supplied through the ambient scope.
- **`visibleWhen` is tested before `visible`.** The memo hoists `properties.*`
  onto the node, so a node carrying `properties.visible` short-circuited the
  declared node predicate — the one key the spec tells authors to write was the
  one key that could be silently ignored. The two deprecated aliases
  (`visibleOn` / `visibility`) deliberately keep their rank: they normalize into
  `visibleWhen` at parse, so a spec-parsed page never reaches them.
- **An unresolvable predicate is loud** (dev builds). Fail-soft answered "this
  predicate is broken" and "this predicate said yes" with the same word. The
  verdict is unchanged on every path — `evaluateCondition` already returned
  `true` for every unevaluable predicate, including the non-negated `hidden` /
  `hiddenOn` legs where that `true` means HIDE — so only the silence moved.

**Behaviour change, stated plainly:** a shipped page whose node-level
`record.*` predicate was previously inert now evaluates. A block that was
permanently visible may begin to hide — which is the point, but it is a verdict
change, not a no-op. `properties.visible` is unaffected in verdict: an
in-tree census found **zero** node-level `record.*` predicates on page
components, so nothing in this repository changes verdict.
