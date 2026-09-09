---
'@object-ui/types': minor
---

Declare the query members both renderers already read on `ObjectKanbanSchema` and
`ObjectCalendarSchema` — `filter` on both, `sort` on the calendar
(objectstack-ai/objectui#8174).

`filter` had four declaration faces and only three of them named it:
`@objectstack/spec` declares it (`ComponentPropsMap['object-kanban']` and
`['object-calendar']`), both plugins' registration `inputs` publish it, and both
renderers read it — `ObjectKanban.tsx` lowers `schema.filter` onto `$filter`,
`ObjectCalendar.tsx` lowers `schema.filter` onto `$filter` and `schema.sort` onto
`$orderby` through `convertSortToQueryParams`. This package's own published faces
(the TypeScript interface and its zod mirror) named none of them, so an authored
value reached the renderer only through `BaseSchema`'s index signature and the
mirror's `.passthrough()` — admitted, never examined. That is the same reasoning
objectstack-ai/objectui#7322 used to move `groupBy` and `limit` into this same
interface.

Spelled exactly as `ObjectGanttSchema` spells them, so the views' query
vocabularies cannot fork: `filter?: any[]` mirrored as `z.array(z.any())`, and
`sort?: SortConfig[]` mirrored as `z.array(SortConfigSchema)`. Both members are
optional on both faces, so no node that omits them changes verdict.

Additive on the type face and on the accept set; nothing that validated before is
refused now. What does change verdict is a WRONG-TYPED value at a correctly
spelled key, which the index signature and `.passthrough()` used to admit
unexamined: `filter: 'status = open'` and the objectstack-ai/objectui#8221-retired
string clause `sort: 'name asc'` are now refused at authoring time instead of
type-checking green, parsing green, and then being dropped at runtime by
`convertSortToQueryParams` — which is why this is a `minor` and not a `patch`.

No `sort` on the kanban board: `ObjectKanban.tsx` has zero `schema.sort` read
sites and the spec's `object-kanban` entry declares no `sort` either.

The `BaseSchema` index-signature ceiling measured by
objectstack-ai/objectui#7927 is unchanged — a MISSPELLED key is still admitted on
both faces, and the accompanying pin asserts that rather than claiming otherwise.
