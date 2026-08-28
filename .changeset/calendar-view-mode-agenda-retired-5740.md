---
'@object-ui/types': minor
---

`'agenda'` leaves `CalendarViewMode` and the zod `CalendarViewModeSchema`
(objectui#5740 — the value-level residue of objectui#5667's key-level
convergence of `CalendarViewSchema` on the registered `calendar-view`
renderer's measured read set; ADR-0049 enforce-or-remove).

The union declared a value nothing enforced: the registered renderer's `view`
input declares `enum: ['month','week','day']`, `resolveAuthoredView` resolves
any off-enum value — `'agenda'` included — to `undefined` (the component's
`'month'` default), and `CalendarView` renders no agenda view. An author
writing the type-legal, zod-valid `view: 'agenda'` got a month calendar with
no error or warning. No in-repo, example, or catalog app authors
`view: 'agenda'` (measured during objectui#5667's sweep and re-measured for
this change, including the objectstack tree).

**This narrows the accept set — unlike #5667's key retirements, which created
no new rejections.** `view` is a declared key, and declared keys are validated
even under `.passthrough()`, so `view: 'agenda'` is now a **validation error
that previously parsed green** (an `invalid_value` issue on the `view` path,
offering `month`/`week`/`day`). Undeclared keys still pass through unchanged.
Breaking on the published zod surface; ships as `minor` per this repo's
version-alignment policy (majors track `@objectstack`).

The runtime boundary is unchanged: an off-union `view` in raw metadata still
falls back to the component's `'month'` default at the renderer, and the
registry input already declared the three-value enum. Docblocks, the schema
reference table, and the zod `describe` no longer teach an `'agenda'`
fallback.
