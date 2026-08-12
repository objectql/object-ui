---
"@object-ui/plugin-calendar": patch
---

`object-calendar` / `view:calendar`: the renderer now consumes or declares every prop it forwards, instead of spreading the authored node into `ObjectCalendar`

One shared renderer serves both registrations, and it ended in a raw spread of everything `SchemaRenderer` hands a widget — the node's authored keys, its `props` container, the injected runtime props and a host's trailing props — onto a component whose props are a closed list. `ObjectCalendarProps` declares eight callbacks and a `locale`, so an authored value under any of those names landed on the declared prop, and an SDUI author writing JSON can never produce a function:

- an authored `onDateClick` string threw `onDateClick is not a function` on an empty day-cell click, and an authored `onNavigate` string threw on **Next period** — both as *uncaught* window errors, because React does not route event-handler errors to `SchemaErrorBoundary`, so the calendar kept looking fine while that gesture was dead;
- an authored `locale: 'en_US'` (the underscore spelling a producer writes by accident) threw `RangeError: Incorrect locale information provided` out of render and took the whole calendar to the error boundary.

The forward set is now exactly `ObjectCalendarProps`, each key resolved to the type that prop declares: the callback family is a declared, function-typed host escape hatch, `locale` is accepted only when `Intl.getCanonicalLocales` takes it, `data`/`loading` keep the parent pre-fetch path at their declared types, and everything else — including the open tail of authored keys — is dropped.

Host-passed functions are unaffected: a React host's handlers, and `ListView`'s `onRowClick`, still reach the component exactly as before.
