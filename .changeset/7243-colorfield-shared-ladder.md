---
'@object-ui/core': patch
'@object-ui/plugin-gantt': patch
'@object-ui/plugin-calendar': patch
'@object-ui/plugin-timeline': patch
---

`colorField` now means the same thing in the gantt, the calendar and the timeline
(objectui#7243).

**The inversion this fixes.** `gantt.colorField` is documented as "field that drives the
bar color", and the renderer passed the stored value straight into the bar's
`backgroundColor`. Pointing the key at a select field therefore emitted
`backgroundColor: "open"` — not a colour, so the browser dropped the declaration and
every bar rendered identically. OMITTING the key was strictly better: the absent-key
branch derived a real colour per status. Declaring the documented key was worse than not
declaring it, with no error, warning or console message either way.

The same key also meant three different things across the three lenses: the timeline
resolved the field's authored option `color`, the calendar hashed the raw value onto a
fixed palette, and the gantt emitted the raw value. An author colouring three views by
one field got three unrelated results, one of which was no colour at all.

**The ladder.** `@object-ui/core` gains `createFieldColorResolver` — the timeline's
resolver, lifted so all three call it:

1. the field's own option `color` for the record's value;
2. else the value itself when it already IS a colour literal (`#rgb`, `#rrggbb`,
   `#rrggbbaa`, `rgb(...)`, `hsl(...)`);
3. else each renderer's own last rung, which is deliberately NOT shared — the gantt
   derives a semantic-token hex (a bar must be painted), the calendar keeps its
   theme-aware 8-stop hash (a soft tint, not a solid fill), the timeline draws its
   default marker.

**What changes for authors.** A gantt or calendar whose `colorField` points at a select
field with authored option colours now paints those colours. A gantt value that is
neither an option colour nor a colour literal now derives a colour instead of emitting
an invalid CSS value — including a palette NAME (`red`), which now resolves to that
palette's hex, the behaviour the key's own contract has always promised ("hex or
semantic name") and the one `borderColorField` already had. `gantt.borderColorField`
takes rung 1 as well, so an authored option colour reaches the alert stroke; it keeps
today's behaviour otherwise and deliberately gains no derivation rung, since the stroke
is opt-in and deriving one for every record would draw an alert on records that have
none.

Calendars whose `colorField` points at a plain categorical field are unchanged: that
value still reaches `CalendarView`'s deterministic hash exactly as before. The timeline
is unchanged apart from accepting the 8-digit `#rrggbbaa` hex spelling the calendar
already accepted.
