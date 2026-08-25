---
"@object-ui/plugin-form": patch
---

`object-master-detail-form` declines to fetch a detail collection whose child object it never resolved, instead of calling `getObjectSchema(undefined)`.

`childObject` is REQUIRED on `MasterDetailDetailConfig` and is what every downstream read is keyed
on — `deriveDetail(d.childObject, …)`, the child-schema cache, and the FK scope of each child
fetch. But a detail entry reaches the renderer straight off an authored schema, so a malformed one
arrives with the key `undefined`, and the resolve effect asked the data layer for it anyway.
Measured: mounting the block with a detail entry that carries no `childObject` issued
`getObjectSchema(undefined)` — a real backend receives a query for an object literally named
`undefined`, and whatever it returns becomes the console's problem.

The resolve effect now skips such an entry and warns, leaving it in place so the grid card shows
its config hint and the row-state array stays index-matched. This is the choice `RelatedList`
already makes for the same class of missing key (*"has no referenceField/parentId — refusing to
fetch all rows"*), and the sibling child-schema-cache effect in this same component already spelled
it `.filter(Boolean)`; the three now agree. A detail collection that names its child object fetches
exactly as before.
