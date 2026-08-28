---
'@object-ui/plugin-calendar': patch
---

`README.md`'s "Schema API / CalendarView" block described a `CalendarViewSchema`
that does not exist. Measured against the interface itself
(`packages/types/src/complex.ts`) and its zod mirror: `events` — the schema's
only required key besides `type` — was published as `events?`, so a reader
following the README omits it and TypeScript rejects the node; `defaultDate` was
`string` where the schema says `string | Date`; and `onDateClick` was listed as a
schema key when it is a `CalendarViewProps` **component** prop, sending readers
to a different package's surface for a key `calendar-view` does not have (the
schema's key is `onDateChange`). The block also listed 6 of the schema's 13 keys
with nothing saying it was a summary (objectui#5045).

The block now carries the requiredness the schema declares, names itself a
partial summary of `CalendarViewSchema`, and adds the author-facing
`defaultView` / `view` / `views` / `editable` / `date`. It also states plainly
what the registered `calendar-view` renderer actually reads — it builds events
from the node's `data` array and drops an authored `events` key (objectui#4433) —
so the corrected requiredness does not itself become a new wrong instruction.

This is a documentation fix to a file `plugin-calendar` publishes to npm, which
is why it carries a version: the npm landing page only picks up the correction
on a release. No behaviour, export, type, or `dist` byte changes. The pin test
added alongside it publishes nothing.
