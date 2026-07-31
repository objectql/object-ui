---
"@object-ui/plugin-view": patch
---

refactor(view): remove ObjectView's filter/sort bar, which was never connected

`ObjectView` carried its own filter and sort bar: `filterValues` / `sortConfig`
state, a `filter-ui` schema and a `sort-ui` schema, ~80 lines of field
introspection to build them. None of it was wired. No setter was ever called and
neither schema was ever rendered — both states sat at their initial empty value
for the component's entire life.

Removed rather than wired, because the real filter and sort UI belongs to the
renderer this component delegates to. `showFilters`, `showSort` and
`filterableFields` are forwarded downstream and `ListView` implements them for
real. Connecting the local copy would have produced a *second* filter bar
competing with that one.

The dead state was not inert, though — it left a branch in every merge path that
could never run, and those branches read as live code:

- The fetch path merged `baseFilter` with a `userFilter` that was always `[]`.
- `mergedFilters` (what the `renderListView` slot receives, used by the Studio
  design surface) opened with a branch that **replaced** the view's filter with
  the user's instead of combining them — which would have been a real bug had
  the state ever been written.

Two "defects" reported against these branches during #3081 were unreachable for
exactly this reason; that changeset carries the correction. Keeping code that
looks live and cannot run is what made the misreading possible twice, which is
the argument for deleting it rather than leaving it for the next reader.

No behaviour change: every removed branch was unreachable, and the surviving
paths are pinned by new tests covering both what the component queries with and
what it hands the delegated renderer.
