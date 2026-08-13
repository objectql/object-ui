---
'@object-ui/app-shell': patch
---

The Studio Data pillar's grid no longer issues a duplicate `find()` on every render (#4567).

The pillar built its object-view `table.fields` inline, allocating a fresh columns array on every render. That array's IDENTITY is a data-fetch input downstream: plugin-view's ObjectView forwards it to the `renderListView` slot as `columns` by reference, and ListView derives its `$expand` fields from `schema.columns` with the array in that memo's dependency array by identity, which is itself in the fetch effect's dependency array. So each render of the pillar issued another list query — measured 1 to 4 across three re-renders that changed nothing. It was invisible in the UI (the rows repaint with the same data) while multiplying backend load on a surface that re-renders at keystroke rate.

The columns array is now memoized on the draft's `fields`, so it changes identity only when its contents change. The dependency stays live: adding, removing or reordering a field still refetches. The fix is module-local memoization at the producer — `ListView`'s by-identity dependency is correct for a genuine column change and is untouched, as is the refresh channel pinned by #4549.
