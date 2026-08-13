---
'@object-ui/plugin-calendar': minor
---

`calendar-view` has no declared-but-inert inputs left: `allowCreate` works, `colorMapping` is retired (objectui#4454, objectui#4493)

Two of this widget's registry inputs were declared and read by nobody — the one
state ADR-0049's enforce-or-remove framing says must not persist. Measurement
answered them in opposite directions.

**`allowCreate` is enforced.** The handler it would gate was already built in the
renderer — `handleAddClick`, dispatching `{ type: 'create', payload: {} }` on the
widget's own `onAction` channel — and simply never passed. `CalendarView` renders
its **New event** button behind `onAddClick`, so on the SDUI path that button
never existed and the handler was unreachable: both halves of one feature were
present and had never been introduced to each other. An authored
`allowCreate: true` now supplies the handler to `onAddClick`, and clicking the
button dispatches the create action.

The wiring goes through the declared `onAddClick` hatch rather than around it via
a second prop. That key is already one of the renderer's function-typed host
hatches (objectui#4453), so a React host could switch the affordance on today and
that path is untouched — a host handler still replaces the action dispatch rather
than running alongside it, the same precedence `onEventClick` keeps. An authored
`onAddClick` string is still dropped, so turning the affordance on cannot
reintroduce that card's uncaught handler crash.

Only the boolean `true` turns it on. Absent, `false`, and the off-type spellings
JSON invites (`'true'`, `1`, an object) all resolve to the absent-key answer, which
on this prop is literally what makes the button not render. Every node that never
authored the key renders exactly as before.

**`colorMapping` is removed.** It had no read site anywhere: the renderer's event
mapping takes the colour straight off the record (`color: record[colorField]`),
and `CalendarView` resolves a colour from `event.color`. An author who wrote the
documented `colorMapping: { meeting: 'blue' }` got no mapping, no warning and no
error — the raw field value was used as the colour, which for a picklist value
like `meeting` is not a colour at all. It is retired rather than implemented
because no measured app authors it, and a capability with no pull behind it is not
worth building. The `content/docs/plugins/plugin-calendar.mdx` schema-API line
documenting it is removed in the same change.

Retiring it is not a behaviour change — the key never had a read site to lose. It
becomes an ordinary unknown authored key, dropped at the renderer boundary like
any other.

**Grade.** Minor, not patch: measured both ways against the emitted bundle, the
published registry surface moves — `calendar-view`'s `inputs` array loses a member
(`colorMapping`: 1 emitted declaration before, 0 after), so the authorable
vocabulary this widget publishes narrows by one key, and a second declared input
starts producing a user-visible affordance. The emitted `.d.ts` is byte-identical
either way; the vocabulary lives in the runtime registry metadata, not in the type
surface.
