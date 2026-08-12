---
'@object-ui/plugin-calendar': patch
---

authored ISO `currentDate` reaches the calendar as a `Date`; unparseable input falls back to the default instead of crashing

`plugin-calendar:calendar-view` declares the input `{ name: 'currentDate', type: 'string', description: 'ISO date string for initial calendar date' }`, while `CalendarViewProps.currentDate` is a `Date`. Nothing converted between the two: the authored string rode the renderer's trailing `{...props}` spread into `useState`'s initial `selectedDate`, and the header's `selectedDate.toLocaleDateString(…)` threw `selectedDate.toLocaleDateString is not a function` — the error boundary instead of the calendar. Writing the one spelling the input documents was the one spelling that could not work, and there was no correct authored value at all, since `type: 'string'` cannot express a `Date`.

The renderer now owes the conversion, at its own boundary. `currentDate` is destructured out of the incoming props so the spread can no longer carry the raw value (the consumed-key pattern from the `events` collision fix), parsed once per authored value, and passed to `CalendarView` as the `Date` its prop type declares. Off-spec input — an unparseable string, or any non-string that is not already a `Date` — gets the same answer as an absent key: the component's own default date. An `Invalid Date` is never manufactured and handed on; it does not throw, it renders the literal text "Invalid Date" into the header and the date picker, which is a silent wrong answer where the default is a usable calendar.

A `Date` instance passes through untouched, so a React host handing the widget its real declared prop type is unaffected.
