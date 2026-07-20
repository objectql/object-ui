---
"@object-ui/app-shell": minor
---

feat(flow-designer): map free-form object maps → keyValue (and numeric arrays → numberList) in the schema-driven inspector (#3304)

The server-first flow-designer form generator (`jsonSchemaToFlowFields`, ADR-0018)
had no way to render the flat `{ var: value }` **keyValue** editor from a JSON
Schema, so any node whose config uses a free-form map — a CRUD node's `fields` /
`filter`, an `assignment`'s `assignments`, a connector's `input`, a screen's
`defaults` — could not be driven from its published `configSchema` without
dropping that editor to raw Advanced JSON.

The adapter now maps:

- an object with **`additionalProperties`** (a value schema, or `true`) and **no
  fixed `properties`** → a `keyValue` field (the object-with-`properties` case
  still flattens to sub-fields; an opaque object or `additionalProperties: false`
  still falls through to the Advanced block);
- an array of **number / integer** → `numberList` (the sibling of the existing
  array-of-string → `stringList`).

This is a pure capability addition — inert until a node publishes such a schema,
so no existing form changes. It unblocks giving the previously schema-less flow
nodes (assignment, the CRUD quartet, script, subflow, screen) a server-driven
config form that matches their hardcoded one, the objectui half of framework
#3304 (the descriptor-side counterpart to #2670 Phase 3).
