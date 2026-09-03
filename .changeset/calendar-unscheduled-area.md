---
'@object-ui/plugin-calendar': patch
'@object-ui/i18n': patch
---

fix(plugin-calendar): a record with no date is no longer placed on today

`ObjectCalendar` mapped a record whose declared `startDateField` carried no
value to `new Date()` — the current moment — so it rendered on today's cell as
an ordinary event, indistinguishable from a real one. The `isNaN` guard six
lines below could not catch it by construction: a no-argument `new Date()` is
always valid, so the absent-value case became a well-formed lie *before* the
check that would have caught it.

The fabricating arm is deleted. Such records now leave the grid entirely and
appear in a collapsed "Unscheduled (N)" area below the calendar — a visible
count and an expandable list, with no invented date and no scheduling UI. The
`isNaN` filter keeps its original job for values that are present but
unparseable: absent and malformed stay two distinguishable outcomes.
`allDay: !endDate` now applies only to records that have a start, so a record
with no dates at all is unscheduled rather than silently all-day; a record with
a start and no end still renders all-day exactly as before.

Adds `calendar.unscheduled` to all ten locale packs.
