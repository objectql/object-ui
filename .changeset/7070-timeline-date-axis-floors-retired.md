---
'@object-ui/plugin-list': minor
'@object-ui/plugin-view': minor
---

Retire the `'created_at'` timeline date-axis floors at both plugin faces
(objectui#7070 step ③, maintainer ruling 2026-09-01, 总监批 #28).

**Breaking, deliberately.** A timeline view that declares **no** date axis anywhere no
longer renders. `ListView`'s and `ObjectView`'s timeline branches used to hand
`ObjectTimeline` a `startDateField` of `'created_at'` for such a view; both now forward
a declared axis or no key at all, and the renderer shows its "declare a date axis"
refusal instead.

House posture, entered with the ruling: **日期轴永不虚构** — a date axis is never
fabricated. This is the third and last step of a sequence the ruling ordered and forbade
reordering: `ObjectTimeline` gained the refusal screen and lost its own internal
`|| 'date'` floor first (objectui#7459), which by its own measurement changed nothing a
user could see — precisely because these two faces still supplied a name. They are the
supply.

The floor was not a harmless default. `'created_at'` is a column nearly every object
carries, so downstream it was indistinguishable from a real binding and could never
resolve to nothing — while the `$select` projection is collected from the **declared**
`timeline` / `options.timeline` blocks and never from this prop. An undeclared view was
therefore given a timeline bound to a column the query had not requested, and every
record bucketed into "No date": a screen that looks built, is wrong, and gives the
author no signal. The ruling also explicitly replaced the written decision that stood on
the deleted `ListView` line ("`created_at` stays the last resort for a view that
declares no date axis anywhere") — it was a second, de-facto contract held at one face,
on the very literal objectui#3129 had retired at the app-shell face.

**Migration.** Declare the axis on the view: `timeline.startDateField` (spec-canonical),
`timeline.dateField` (legacy alias), or a `calendar.startDateField` — objectui#3129
established that a calendar binding is a legitimate timeline axis, and it still is. All
three keep rendering exactly as before; only the *undeclared* case changes. A view that
really did want records laid out by creation time says so in one key:
`timeline: { startDateField: 'created_at' }`. The refusal names the accepted keys on
screen, so an affected view reports its own fix.

`titleField` is unaffected and keeps its `'name'` floor at both faces — it is not a date
axis. So do gantt's `progressField` / `dependenciesField`, which the ruling scoped out
for separate evaluation.
