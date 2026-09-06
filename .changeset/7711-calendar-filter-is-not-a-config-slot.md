---
'@object-ui/plugin-calendar': minor
---

Retire the `filter.calendar` configuration spelling on `object-calendar` (objectui#7711).

**Breaking, deliberately.** `getCalendarConfig` no longer probes `schema.filter` for a
`calendar` key. A calendar whose configuration was written as
`filter: { calendar: { startDateField: … } }` no longer resolves a configuration at all
and now renders the component's existing "Calendar configuration required. Please
specify startDateField and titleField." refusal screen. Write the configuration under
the declared `calendar` container instead — the read for it already existed, directly
below the retired arm.

`filter` is the query filter and nothing else. `@objectstack/spec`'s
`ComponentPropsMap['object-calendar']` declares `calendar` as the configuration
container and `filter` as the base query filter, and admits no `filter.calendar`
spelling; the renderer nevertheless read the config out of the filter FIRST, and the
comment on the canonical read below called *that* one the "backward compatibility"
branch — the contract inverted in a source comment. The arm and the comment are both
gone. No compatibility rung and no deprecation window, per AGENTS.md #0.1: a tolerant
fallback fossilizes the wrong convention into a second de-facto contract.

**The bug this closes is not only the retired spelling.** One authored key was being
read twice with two incompatible meanings. `filter: { calendar: 'team' }` — a
legitimate condition on a field literally named `calendar` — was returned as the
`CalendarConfig` while the same object still went to `$filter` on the wire. `'team'` is
truthy, so the refusal screen did not fire either: `startDateField` destructured off a
string is `undefined`, every record fell into "unscheduled", and the grid rendered empty
while the author's declared `calendar` block sat unread. Such a filter now reaches
`$filter` untouched and the declared container is what configures the calendar.

The calendar twin of the `filter.map` retirement in objectui#4034, with one measured
difference: there is no `Array.prototype.calendar`, so `'calendar' in schema.filter` was
never true for an array-shaped filter the way `'map' in schema.filter` was true for
every one of them. Only an object-shaped filter with an own `calendar` key ever reached
the retired arm, and the calendar answers the loss of a configuration with a named
refusal on screen rather than the map's silent fallback to default field names — so this
retirement carries no dev-time diagnostic rider.

**Migration.** A census of this repo found **zero** authored `filter: { calendar: … }`
sites (both the object-literal and JSON spellings, with positive controls and a planted
fixture proving the search fires).

Also in this change: the `calendarConfig` memo's dependency list drops `schema.filter`,
which the function no longer reads, and gains the three flat keys it does read but the
list never named — `startDateField`, `endDateField` and `allDayField`. Dropping `filter`
removed an accidental co-trigger that used to pick those up whenever a filter changed
alongside them.
