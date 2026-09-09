---
"@object-ui/plugin-detail": patch
---

fix(plugin-detail): `record:related_list` can now bind to a multi-value relationship field

`RelatedList` compiled its parent-relationship condition as bare equality
regardless of the field's arity. When the relationship field is declared
`multiple: true` — `Field.user({ multiple: true })` is the platform's own shape
for "one record names N people" — the stored value is an array persisted as a
JSON column, `=` compares that whole serialized value against a single id, and
the driver refuses with `400 INVALID_FILTER` while prescribing `$contains`. The
membership spelling was not reachable from the authoring surface at all: the
parent filter is composed by the component from `relationshipField` alone, so
the list could not be written correctly, only not written.

The condition is now compiled to match the field's declared arity, read off the
child object's schema the component already fetches: `multiple: true` becomes
`{ [relationshipField]: { $contains: parentId } }`, everything else keeps `=`
byte for byte. No authoring key was added — the author is naming a
relationship, and its storage form is the renderer's business.

The legacy raw-URL fallback (no `dataSource` adapter) cannot express membership
at all: its `filter[<field>]=<value>` grammar carries no operator, and the
repo's one operator contract for that spelling recognises only `gte`/`lte`/
`gt`/`lt` and DROPS anything else — a hopeful `[contains]` suffix would arrive
as no condition, i.e. an unscoped fetch of the whole child table. That path now
refuses and says so, the same posture the sibling filter arm and the
unscoped-fetch guard already take.
