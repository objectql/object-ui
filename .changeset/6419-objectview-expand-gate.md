---
'@object-ui/plugin-view': patch
---

`ObjectView`'s non-grid fetch now carries `$expand` (objectui#6419). The effect built its
expand set from `objectSchemaRef.current` — a ref assigned in the render body, deliberately
kept out of the effect's dependency list so the effect would run exactly once per mount. On
that one run the ref was still `null`, so `buildExpandFields` saw no fields and the query
went out as `{ $top: 100 }` with no `$expand` at all; because the effect never re-ran on the
schema's arrival, it never went out with one either.

`ObjectView` hands the rows it fetches to the child view as `data={data}`, which suppresses
that child's own fetch. So every lookup / master_detail / user / tree field in the six
non-grid views it hosts — kanban, calendar, gallery, timeline, gantt, map — rendered from
raw foreign-key ids: blank on the kanban (its `resolveDisplay` suppresses opaque ids) and
potentially the raw id on the other five.

The object schema and the fact that its read has SETTLED are now one piece of state, keyed
by object name, and the record query waits on it — the shape `ObjectKanban` adopted in
objectui#6271. The gate is on the read having settled, **not** on a truthy schema: a view
whose adapter exposes no `getObjectSchema`, or whose read threw, still queries (unexpanded)
rather than waiting forever, and switching objects closes the gate in the same commit rather
than sending the previous object's expand set.

The trade was measured on this effect rather than inherited, because it has five more
dependencies than the board's. With an instrumented adapter (schema and `find` both 30ms)
across four host regimes: before, one query with no `$expand` and one raw delivery to the
child; with `objectSchema` merely added to the dependency list, two queries and two
deliveries — `raw` then `expanded`, a visible two-step paint, because here the raw rows
settle into state *before* the re-run's cleanup rather than being discarded as they were on
the board; gated, one query carrying `$expand` the first time and a single expanded
delivery, with correct rows landing at the same wall clock as the dependency version.
