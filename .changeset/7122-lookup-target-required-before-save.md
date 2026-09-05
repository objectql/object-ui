---
'@object-ui/app-shell': patch
'@object-ui/plugin-designer': patch
---

Refuse to save a `lookup` / `master_detail` field with no target, instead of
PUTting it and blocking the object (objectui#7122).

`@objectstack/spec` 17.3.0 makes `reference` a hard requirement on the two
relationship field types — a `custom` refinement at path `reference`, measured
on the installed build; at 17.2.0 the requirement was prose only and
`{ type: 'lookup', label: 'L' }` parsed green. The designer relied on that
latitude and PUT half-filled drafts.

Against a matched 17.3.0 backend that PUT returns `422 INVALID_METADATA` for the
WHOLE object document, so the damage is not confined to the incomplete field:
every later save of that object fails the same way until the draft is completed
or removed by hand.

Both metadata writers now raise before the request — `MetadataService.saveFields`
and `MetadataFieldsPage`'s own field-map conversion — naming the field and what
to do about it. The message lands in the page's existing error banner, the same
one a nameless or duplicated field already produces; no new UI affordance, and
no request is issued. A relationship field WITH a target is unaffected.

Picked over the cheaper alternative deliberately: flipping the parity pin green
while the product still PUT the draft would have pinned a known-broken save
path.
