---
'@object-ui/components': patch
'@object-ui/plugin-dashboard': patch
---

A `bind` authored on a `data-table` is now diagnosed at render instead of ignored in
silence (objectui#6575).

`bind` is the data-scope vocabulary: a path string resolved by `useDataScope()`.
`list`, `tree-view` and the `object-*` plugin widgets read it. `data-table` does not
— it takes its rows from an inline `data` array on the node and never calls the hook.
A `bind` on a `data-table` was nevertheless accepted by every gate: the TS side via
`BaseSchema`'s index signature, the zod side via `BaseSchema` being `.passthrough()`,
which `DataTableSchema.extend(…)` inherits. Nothing read it at render, so the author
got a table drawing a correct-looking header over the "No results found" empty state,
with no error and no warning — a success receipt for a disagreement between the
author and the renderer, and the hardest failure shape for a human or an AI author to
self-check.

The platform was already paying for this in teaching rather than in diagnostics:
`skills/objectui/rules/protocol.md` documents the pothole verbatim and a pin test
locks the behaviour. The warning now also reaches the console, where the author who
did not read the docs is standing:

> `bind: 'customers'` is ignored: data-table does not read `bind`; it reads its rows
> from the inline `data` array on the node. This node has no inline rows, so the
> table renders its header over an empty body.

It names the node's address, the path that was spelled, and the way out. The
consequence clause is measured rather than asserted: a node carrying BOTH `data` and
`bind` is not empty, and is told that its rows came from `data` and its `bind`
contributed nothing.

**No behaviour change.** `data-table` still does not read `bind`, and per the
2026-08-27 ruling it must not start — making it a `useDataScope` reader is a separate
published-surface question needing its own ruling, including a `data`-vs-`bind`
precedence. Refusing the key at parse stays blocked on the `.passthrough()` ceiling
(objectui#5155 / objectui#6269). The trap stops being silent; it does not stop being
a trap. The channel is the one `plugin-grid`'s `columnSpellingDiagnostics.ts` already
uses for this exact shape of failure — a pure describe function, a `useEffect` keyed
on the schema slice, one `console.warn`, no NODE_ENV branch.

`ObjectDataTable` (`@object-ui/plugin-dashboard`) stops forwarding a `bind` it has
already consumed. It resolves the binding itself via `useDataScope(schema.bind)` and
then delegated with `{ ...schema, type: 'data-table', … }`, which handed the spent
key to a component that cannot read one. Without this, a correctly authored and
published-guide-taught `object-data-table` would have tripped the new diagnostic on
every render, over rows that were on screen precisely because its `bind` had been
honoured. The key is stopped where it was spent — the same shape its sibling
`DashboardGridLayout` already uses for `data`. Nothing else about that delegation
moved, and the bound rows still arrive.
