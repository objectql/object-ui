---
'@object-ui/components': patch
---

data-table row menu — the built-in Edit/Delete predicate parameters are derived from the authoring type, not hand-restated

One authoring shape (`DataTableSchema.rowEditPredicates` / `rowDeletePredicates`, objectui#2614) had grown four separate declarations in `renderers/complex/data-table.tsx`: the shared `isBuiltinRowActionVisible` gate and `planDataTableRowMenu` each hand-wrote `{ visibleWhen?: unknown }`, and the row-menu ITEM component hand-wrote the full `{ visibleWhen?: unknown; disabledWhen?: unknown }` pair. Nothing tied any of them to the type whose values they receive, so a rename in `@object-ui/types` would have left all four compiling against a shape that no longer existed — the objectui#3009 hand-copy family, in miniature.

Each one now derives. The planner keeps its deliberate visibility-only subset, `Pick`ed from the very key its caller passes (`Pick<NonNullable<DataTableSchema['rowEditPredicates']>, 'visibleWhen'>` and the delete twin), so the signature still tells the truth about what the function reads while becoming structurally unable to drift from what it subsets. The two consumers that serve both built-ins share one derived alias taken from the union of the twins, so they may only read keys both schema keys declare. Measured: with `visibleWhen` renamed in `@object-ui/types`, the previous hand-written declarations still type-check clean, the derived ones fail to compile.

No behavior change — no runtime code was touched, and the package's suite passes unchanged. Alongside it, the "a disabled item still counts toward the menu" rule gains the pin it never had where a user meets it: a row whose only action is `disabledWhen`-gated keeps its "⋮" trigger, and that trigger opens the item, present and `aria-disabled`. The two halves of that rule live in different functions, and each half's own test stayed green while the other regressed.
