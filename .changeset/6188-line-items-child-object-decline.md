---
"@object-ui/plugin-form": patch
---

`record:line_items` declines to fetch the child schema of a panel whose child object it never resolved, instead of calling `getObjectSchema(undefined)`.

`childObject` is declared `required: true` on the block's registry entry and typed `string` on
`LineItemsPanelSchema`, but nothing enforces either — `inputs[].required` is designer metadata, and
the block has no spec schema — so a node reaches the renderer straight off an authored schema with
the key `undefined`, and the child-schema effect asked the data layer for it anyway. Measured:
mounting the block through the registry with `childObject` unset issued
`getObjectSchema(undefined)`, and a real backend receives a query for an object literally named
`undefined`. The effect's `.catch` then turned the answer into a null child schema, so the visible
outcome was a silently unsanitized child grid rather than an error.

The effect now declines and warns, naming the key and what to set it to, and clears the cached child
schema so a later save is never sanitized against a previous object's fields. This is the choice
`RelatedList` already makes for the same class of missing key (*"has no referenceField/parentId —
refusing to fetch all rows"*), and the one `object-master-detail-form` makes on this exact key. A
panel that names its child object fetches exactly as before.
