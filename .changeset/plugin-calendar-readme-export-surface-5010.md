---
'@object-ui/plugin-calendar': patch
---

`plugin-calendar`'s README no longer documents imports the package does not export.

Three defects in `packages/plugin-calendar/README.md`, all of which made a
copy-pasted snippet fail to compile. Checked by taking the package's real export
name set off `src/index.tsx` through the TypeScript compiler API and cross-checking
every import statement in the README against it — including multi-line import
blocks, which a single-line grep cannot see.

1. **Fabricated (deleted).** A "Manual Registration" section taught
   `import { calendarComponents } from '@object-ui/plugin-calendar'` followed by
   `Object.entries(calendarComponents).forEach(register)`. There is no
   `calendarComponents` export and never was — the identifier does not occur
   anywhere in `src/`. Copying it gave `undefined`, and `Object.entries(undefined)`
   throws a `TypeError`, so the section could not run at all. Registration in this
   package is purely a side effect of importing the entry point, so there is no
   components map to iterate. The fabricated section is replaced by what the
   side-effect import actually claims (the three registered schema types and their
   namespaced keys) and by the package's real export surface — `ObjectCalendar`,
   `CalendarView`, `ObjectCalendarRenderer` plus the component prop types. Hosts
   that want their own registry key are shown the honest way to get one:
   registering the exported `ObjectCalendarRenderer` under it.

2. **Wrong import path (path corrected).** `CalendarViewSchema` was imported from
   `@object-ui/plugin-calendar`. The type is real but belongs to `@object-ui/types`;
   this package imports it and does not re-export it, so the documented import was
   a "no exported member" error. The path now points at `@object-ui/types`.

3. **Name collision (import re-pointed).** Correcting (2) alone still left the
   snippet uncompilable: the same example imported `CalendarEvent` from
   `@object-ui/plugin-calendar`, which is a real export but a *different* type —
   the `CalendarView` component's runtime shape (`id: string | number`,
   `start: Date`), not the authored JSON shape (`id: string`, `start: string | Date`)
   that `CalendarViewSchema.events` requires and that the README's own "Calendar
   Event Structure" section documents. The example's ISO-string values therefore did
   not typecheck, and the plugin's event type was not assignable to the schema's.
   Both authored types now come from `@object-ui/types`, and the two same-named
   types are documented side by side so the next reader does not re-pick the wrong one.

No exports were added to make the README true — the docs were moved to the code,
not the reverse.
