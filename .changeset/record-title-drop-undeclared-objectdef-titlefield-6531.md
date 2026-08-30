---
'@object-ui/core': patch
---

`getRecordDisplayName`: stop consulting the undeclared object-level
`titleField`, restoring `nameField` as the top of the object ladder

Step 0 of the unified record-title resolver read
`options?.titleField ?? objectDef?.titleField`. The second leg ranked an
object-level `titleField` above `nameField` — the pointer ADR-0079 Phase 2 made
canonical — and above the deprecated `displayNameField` alias and the legacy
`titleFormat` template.

`@objectstack/spec`'s object schema does not declare that key, and it is not
merely undeclared: the schema is a `strictObject`, so
`ObjectSchema.safeParse({ …, titleField: 'x' })` fails with `unrecognized_keys`
— the same code a nonsense key gets — while `nameField`, `displayNameField` and
`titleFormat` all parse and survive. A producer census across both repos found
nothing that puts the key on an object-shaped payload: not the metadata, not any
`getObjectSchema` implementation (the ObjectStack adapter stamps only reference
keys and field-widget hints), not the lookup-chip path, not the
search-candidate path, and not the platform's own server-side resolver
(`@objectstack/objectql#titleFieldOf` reads `nameField` → `displayNameField`).
Reading a key no producer can ship is a consumer-side alias — the shape
Commandment #0.1 bans — and it inverted the governed-authority default on top of
that.

No authoring surface changes and no view loses its author-chosen title field:
`titleField` remains a real, declared VIEW key (`ui/CalendarConfig`,
`ui/GalleryConfig`, `ui/GanttConfig`, `ui/ListMapConfig`,
`ui/ObjectKanbanProps`, `ui/TimelineConfig`), views hand it in as
`options.titleField`, and that half of step 0 still wins over everything.
The behaviour change is confined to an object payload that carried a key the
contract rejects: it now resolves through the declared ladder instead.
