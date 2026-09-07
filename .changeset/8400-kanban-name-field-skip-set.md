---
'@object-ui/plugin-kanban': patch
---

Kanban cards: key the title-dedupe skip set off the shared name-field resolver

A kanban card printed its record title twice — once as the card heading, once as
the first row of the card body. `ObjectKanban` resolves each heading through
ADR-0079's `getRecordDisplayName`, then builds a skip set so the title field's
raw value is not rendered again as a card field. That skip set read
`objectDef.NAME_FIELD_KEY`, a key nothing produces: `@objectstack/spec@17`'s
object schema declares `nameField` (canonical) and `displayNameField` (its
deprecated alias), and `NAME_FIELD_KEY` occurs nowhere in the framework tree —
this repo reads it only as the last rung of the compatibility ladder inside
`record-title.ts`, and never emits it.

So the read was always `undefined` and the skip set collapsed to its five
hard-coded literals (`name` / `full_name` / `title` / `subject` /
`display_name`). Any object whose name field is spelled otherwise duplicated its
title, which made the defect universal on AI-built apps — their objects name
fields `visit_title`, `owner_name`, `<entity>_name` — and invisible on
hand-built objects whose name field is literally `name`.

The skip set now reads `@object-ui/core`'s `resolveNameField`, the name-space
twin of the resolver that produced the heading, so the two agree on which field
titles the object: declared `nameField` / `displayNameField` / `NAME_FIELD_KEY`,
otherwise the type-aware derivation.

Deliberately one rung, unlike the same dedupe in `record-details.tsx`, which
also carries `deriveTitleField`: that ladder filters a synthesized field list,
whereas this one filters an author-declared `cardFields`, where dropping a field
the author asked for is a worse failure than a repeated title. A regression test
pins both directions, including an object whose declared and derived pointers
disagree.
