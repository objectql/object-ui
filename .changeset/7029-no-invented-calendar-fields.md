---
'@object-ui/app-shell': minor
'@object-ui/plugin-list': minor
'@object-ui/plugin-view': minor
---

Calendar views no longer render on invented field names (objectui#7029; ruled on
objectstack#13748, director batch #19, option A).

A view that carried no `calendar:` block used to have a complete-looking calendar
configuration synthesized for it. `ObjectCalendar` has always decided whether it
has a usable configuration by asking whether a start-date binding is PRESENT, so
the fabrication short-circuited its own refusal screen — "Calendar configuration
required. Please specify startDateField and titleField." — which existed all
along and was simply unreachable. Measured on a leave-request object whose real
fields are `start_date` / `end_date`: every record piled onto today's cell under
titles resolved through the display-name chain. A plausible, fully wrong screen,
with zero signal to the author.

Three faces were fabricating, on two independent routes to the same renderer:

- `app-shell/ObjectView` emitted `startDateField: 'due_date'` and
  `titleField: 'name'` into `options.calendar` for every object view;
- `plugin-list/ListView`'s calendar branch floored the same two bindings at
  `'start_date'` / `'end_date'` one layer down;
- `plugin-view/ObjectView.generateViewSchema` — the authored `object-view`
  element route, which bypasses `ListView` entirely — carried its own copy.

All three now forward only what the author declared. This converges the calendar
on the shape its siblings already had: `timelineViewOptions` (objectui#3129
retired this very literal from the timeline axis), the kanban lane detector
(ADR-0085, "never invents a field the object doesn't have"), and
`defaultCalendarFromObject` (a binding, or nothing).

**Behaviour change, loud over silent.** With no binding to forward, ADR-0047's
capability gate stops offering the Calendar toggle to views that configured
none, and a view forced onto the calendar renderer reaches the refusal screen
instead of a wrong one. A view that happened to sit on an object carrying a real
`due_date` field was rendering by luck; it now refuses until its `calendar:`
block is written. Correctly configured calendars are unaffected — same fields,
same render. The same deletion also stops the fabricated name from answering for
the Timeline switcher, which accepts a calendar binding as a legitimate axis.

The spec half — cross-field validation rejecting a half-written declaration at
authoring time — is objectstack#13817. This half makes the runtime honest
independent of which spec version the host pins.
