---
'@object-ui/plugin-calendar': patch
---

fix(plugin-calendar): authoring `events` on a `calendar-view` node no longer takes the calendar down

`calendar-view`'s renderer computed a `CalendarEvent[]` from `schema.data`, passed it
as `events={…}`, then spread the remaining props **after** it. `SchemaRenderer`
forwards a node's `events` key as a plain prop, so a node authoring `events` — the
ordinary SDUI action metadata, legal on any node — landed its `{ onClick: [...] }`
object on the `events` array prop: `CalendarView` iterated it and threw
`events is not iterable`, and a spec-legal node rendered an error card instead of its
calendar.

The authored key is now destructured out before the spread, so the computed array
always wins. This also closes the quiet half of the same collision: an authored
`events` **array** never threw — it silently replaced the calendar's contents with
itself.

No capability is removed. Nothing in the renderer layer consumes a node's `events`
key (the action path is `properties.action` through `ActionRunner`), and the
component's own `onAction` channel is unaffected.
