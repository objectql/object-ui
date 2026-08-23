---
'@object-ui/plugin-calendar': patch
---

`@object-ui/plugin-calendar` now exports the `CalendarView` component's runtime event
type as **`CalendarViewEvent`**, and keeps `CalendarEvent` as a **`@deprecated` alias**
of it. **Non-breaking:** the alias is a working re-export denoting the same type, so
code importing `CalendarEvent` from this package keeps compiling unchanged — nothing is
removed and no behaviour changes.

Why: `@object-ui/types` exports its own `CalendarEvent`, the AUTHORING event
(`id: string`, `start` / `end` accept ISO strings with `end` required, plus
`description`), while this package's was the runtime event (`id: string | number`,
`start: Date`, `end?: Date`). Neither is assignable to the other, and IDE auto-import
chose between the two identical names essentially at random — the wrong pick surfaced as
a remote `TS2322` about `Date` rather than as a wrong import, which is how this package's
own README example stayed uncompilable through an earlier import-path fix. The authoring
type keeps the canonical `CalendarEvent` name; the runtime type gets the self-describing
one (objectui#5044, following the `ObjectCalendarProps` -> `ObjectCalendarComponentProps`
rename in objectui#4650).

Write `CalendarViewEvent` in new code.
