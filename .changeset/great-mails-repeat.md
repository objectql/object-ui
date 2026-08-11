---
"@object-ui/plugin-detail": patch
---

`record:related_list` and the detail synthesizer now declare two shapes they already accepted at runtime.

`RecordRelatedListRenderer`'s `schema` prop made `objectName` required, which rejected the exact authoring shape the per-element `dataSource` binding exists to support (`{ relationshipField, dataSource: { object, view } }`) — the gate maps the binding onto `objectName` before the body reads it, so the key is supplied, not missing. It is optional on the wrapper's input now, and required everywhere else.

`ObjectDefLike.fieldGroups` is derived from the spec's authorable field group instead of restating it. The hand-written list had drifted: it omitted `icon` and `description`, both of which the synthesizer passes through to detail section descriptors, so an object definition declaring the group icon the code honours did not type-check against it.
