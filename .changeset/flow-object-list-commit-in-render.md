---
"@object-ui/app-shell": patch
---

fix(app-shell): stop the flow-node repeater from committing during render (#2838)

Operating any `commitCell`-backed control in a flow node's objectList repeater —
checkbox, select cell, record lookup, nested list, remove-row — logged a React
warning:

```
Cannot update a component (`MetadataResourceEditPageImpl`) while rendering a
different component (`FlowObjectListField`).
```

`commitCell` and `removeRow` called `flush()` (which calls the parent's
`onCommit`) from inside their `setRows` updater. React runs updaters during the
render phase, so the parent's `setState` landed mid-render — the exact pattern
React flags. React only warns once per component pair, so whichever control the
author touched first "claimed" the warning and every other one looked innocent.

The handler now raises a commit-intent flag and leaves the updater pure; an
effect flushes after commit. Because the effect reads the rows React actually
applied, a commit no longer risks publishing a stale snapshot when another
update is already queued (typing in a cell and then hitting the row's ✕ in the
same tick).

The plain suites missed this because React computes an updater eagerly when the
fiber has no pending work — that path runs it in the handler and hides the
warning — and because an `onCommit: vi.fn()` parent takes no update at all. The
new regression test reproduces both conditions.
