---
'@object-ui/plugin-view': patch
---

**Bug fix:** a non-grid `object-view` (calendar / kanban / gallery / timeline)
whose sort came from the deprecated `table.defaultSort` no longer comes back
empty. `ObjectGridSchema.defaultSort` is declared a single `{ field, order }`
object, and `ObjectView`'s own fetch handed it to `$orderby` verbatim — where
the ObjectStack adapter reads it as an `$orderby` map and folds it with
`Object.entries`, so the request went out sorting by two columns literally
named `field` and `order`. The server answers `400 INVALID_SORT`, `ObjectView`
swallows the error, and the view rendered with no records — while the *same*
metadata sorted correctly as a grid, because `ObjectGrid` lowers that pair
before using it (objectui#4869, maintainer ruling 2026-08-22).

`ObjectView` now performs the same legacy-to-canonical lowering `ObjectGrid`
already does (`sort ?? (defaultSort ? [defaultSort] : undefined)`) and routes
the whole chain — named view sort, `views` prop sort, `table.sort`,
`table.defaultSort` — through the shared `convertSortToQueryParams` sink. This
was the last object-bound read site sending an authored sort to `$orderby`
unlowered; every other block (gantt, map, calendar, timeline,
`record:line_items`) already did, so an adapter that implements `find` itself
now receives one normalized `Record<field, direction>` from all of them instead
of two different dialects.

Precedence is unchanged, and both spellings of the pair keep working. The
shared sink was deliberately **not** widened to accept a bare `{ field, order }`:
its input slot also legitimately carries `$orderby`'s own map, in which
`{ field: 'desc' }` is a valid ordering by a column named `field`, so widening
it would make one shared function guess.

Two visible shape changes on the wire, both semantically identical to before: a
string `table.sort` such as `'name desc'` now serializes as `-name` rather than
riding through as `name desc`, and a `SortConfig[]` arrives as a map rather than
as an array.
