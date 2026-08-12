---
'@object-ui/plugin-calendar': patch
---

`calendar-view` consumes or declares every prop it forwards — an authored `onEventClick` can no longer crash a click

`calendar-view`'s renderer ended in `<CalendarView … {...props} />`, where `props` was everything `SchemaRenderer` hands a registered widget: the node's authored keys, the contents of its `props` container, the injected runtime props, and a host's trailing props. That is an unbounded set spread onto a component whose props are a closed list, and the worst collision on it was `onEventClick`: an authored `onEventClick: 'NOT-A-FUNCTION'` rendered a perfectly normal calendar and then threw `onEventClick is not a function` on the first click. React does not route event-handler errors to `SchemaErrorBoundary`, so it surfaced as an uncaught window error — the calendar kept looking fine while its click handling was dead. Both authoring channels reached it, the node's own key and a `props: { onEventClick }` container.

The forward set is now exactly `CalendarViewProps`, each key resolved to the type that prop declares; nothing else reaches the component. Declared registry inputs are consumed (`view` narrowed to its declared enum, `currentDate` parsed, `className` forwarded, the field-name inputs read off the schema); `CalendarView`'s callbacks are a declared, function-typed host escape hatch — a host-passed function is forwarded exactly as before, and a non-function value, which is all an SDUI author writing JSON can produce, is dropped, the same answer as an absent key; every other key is dropped.

Fixed with it, from the same boundary: an authored `onAction` string killed the same click through the renderer's own action channel; an authored `onDateClick` / `onNavigate` / `onViewChange` / `onEventDrop` / `onTimeRangeSelect` / `onAddClick` string killed its own gesture the same way; an authored `locale` that `Intl` rejects (`en_US`, the underscore spelling) took the whole render down to the error boundary with `RangeError: Incorrect locale information provided`; and an off-enum `view` (`agenda`) rendered a header with no calendar under it at all, where it now falls back to the component's `month` default.

No capability is removed and no authorable surface is added: every host path that worked keeps working, including the handler precedence the old spread produced (a host handler replaces the `onAction` dispatch rather than running alongside it). The package's emitted `.d.ts` is unchanged.
