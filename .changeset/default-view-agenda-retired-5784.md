---
'@object-ui/types': minor
---

`'agenda'` leaves `defaultView` on all three of its declaration faces
(objectui#5784 — the `defaultView` sibling of objectui#5740's retirement on
`CalendarViewSchema.view`; ADR-0049 enforce-or-remove): the
`ObjectCalendarSchema` TS interface (an inline union `#5740`'s
`CalendarViewMode` narrowing could not reach), the zod `ObjectCalendarSchema`,
and the list-view `calendar` config's objectui-only `defaultView` extension.
All three are now `['month', 'week', 'day']`.

The declarations admitted a value nothing enforced: `ObjectCalendar`'s props
declare `defaultView?: 'month' | 'week' | 'day'`, its schema read casts to the
same three values, and `CalendarView` renders no agenda view. An author
writing the type-legal, zod-valid `defaultView: 'agenda'` on an
`object-calendar` node or in a list view's `calendar` config got a month
calendar with no error or warning. The spec side already agrees:
`@objectstack/spec`'s `ObjectCalendarProps.defaultView` is
`['month', 'week', 'day']`. No in-repo, example, or catalog app authors
`defaultView: 'agenda'` (measured for objectui#5784 with positive controls,
including the objectstack tree — its only `agenda` token is the Agenda
job-scheduler library).

**This narrows the accept set: an author who writes `defaultView: 'agenda'`
will now be refused at validation.** `defaultView` is a declared key, and
declared keys are validated even under `.passthrough()`, so
`defaultView: 'agenda'` is a **validation error that previously parsed
green** (an `invalid_value` issue on the `defaultView` /
`calendar.defaultView` path, offering `month`/`week`/`day`). Undeclared keys
still pass through unchanged. Breaking on the published zod surface; ships as
`minor` per this repo's version-alignment policy (majors track
`@objectstack`).

The runtime boundary is unchanged: `ObjectCalendar` still resolves an
off-union raw `defaultView` away to its `'month'` default. Docblocks and both
zod `describe` strings now teach the three-value set.
