---
"@object-ui/plugin-designer": patch
"@object-ui/types": patch
---

chore(designer): drop the inert object "Enabled" toggle (framework#2377)

The object designer showed an **Enabled** column (`ObjectManager` grid) and an
editable **Enabled** boolean (add/edit object form), backed solely by the object
`active` metadata property. `active` had no runtime consumer and was removed from
`@objectstack/spec` (framework#3199, ADR-0049 enforce-or-remove) — so the toggle
never disabled anything. Toggling it "off" left the object fully queryable and
usable: a false affordance.

Removed the column, the form field, the `active`↔`enabled` mapping/write-back in
`MetadataObjectsPage`, the `enabled?` field on the designer `ObjectDefinition`
type, and the now-unused `appDesigner.objectManager.enabled` string. Non-breaking:
the metadata write path registers objects via `ObjectSchema.parse()`, which already
strips unknown keys, and `ObjectDefinition.enabled` was designer-only.

`isSystem` is unchanged (it stays a live spec property).
