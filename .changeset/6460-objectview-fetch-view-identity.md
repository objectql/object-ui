---
'@object-ui/plugin-view': patch
---

`ObjectView`'s non-grid fetch no longer re-queries once per parent render when the host
passes an inline `views` array (objectui#6460).

The effect that fetches rows for the six non-grid view types (kanban, calendar, gallery,
timeline, gantt, map) listed `activeView` — an **element of the `views` prop array** — among
its dependencies. A host writing `views={[{ id: 'cal', type: 'calendar', label: … }]}`, which
is how this component's own docs write it, produces a fresh element object on every one of
its own renders, so the dependency changed identity every render and a new `find()` went out
each time. Measured with an instrumented adapter and three parent re-renders: **4 queries
where a hoisted array gives 1**. Because `ObjectView` hands its rows to the child view as
`data={data}`, each extra query also re-delivered a fresh row array downstream — the
"duplicate events in child views like the calendar" hazard, from the re-run direction.

The effect now depends on the **values it reads** — the active view's `filter` and `sort`,
plus its `id` — held at a steady reference while they are structurally unchanged, instead of
on the view object's identity. Asking hosts to hoist the array was considered and rejected:
that is a contract change on every caller of a published component, and it leaves the defect
live for every host that does not comply.

Nothing about precedence moves: a named `listViews` config's `filter`/`sort` still outrank
the view's, which still outrank `table.filter`/`table.sort` and their deprecated aliases.
Changing a view's filter, changing its sort, and switching the active view all still
re-fetch. The comparison never serializes, so it stays correct for filter and sort values
that have no faithful stringification — a `Date`, a function, a `Map`, `NaN`, or plain
key-order instability — and every case it cannot model resolves to "changed", which costs a
redundant query rather than withholding a needed one.
