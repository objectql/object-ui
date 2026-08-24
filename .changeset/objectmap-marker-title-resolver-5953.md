---
'@object-ui/plugin-map': patch
---

`ObjectMap` now resolves marker titles through `@object-ui/core`'s
`getRecordDisplayName` (ADR-0079), instead of reading a hard-coded `'name'` key.

`getMapConfig` used to fill an absent title binding with the string literal
`'name'`, and the marker transform then did a bare `record[titleField]` read. For
every object whose display field is not literally `name`, that read was
`undefined`, so each marker popup titled itself `undefined`. The literal is gone
from both branches that carried it, and the read site hands the decision to the
same resolver `ObjectKanban`, `ObjectCalendar` and `ObjectGantt` already title
their items through — `ObjectMap` was the fourth renderer and the only one still
outside it.

An authored `map.titleField` keeps winning outright: it is passed through as the
resolver's explicit `titleField` option, which it checks first. What is new
underneath is everything a static field-name binding cannot express — the
object's declared `nameField`, its deprecated `displayNameField` alias, a legacy
`titleFormat` template, type-aware field derivation, and a name-ish probe over
the record's own keys for the inline-data case where no object definition is
fetched at all.

Records with no resolvable name now read `Record #<id>` rather than `undefined`
or a uniform `Marker`; the `Marker` placeholder is kept only for a record that
carries no id either. No authoring surface changes and no new map config keys.
