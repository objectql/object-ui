---
'@object-ui/app-shell': patch
'@object-ui/types': patch
'@object-ui/fields': patch
---

Delete the dead `metadata-admin/previews/object-fields-bridge.ts` module, and the three
prose references that still described it as wired.

The module exported `bridgeFromDraft`, `commitToDraft` and `FieldsBridgeResult` and had
**zero importers** — re-measured on the merged base, not inherited from the filing. Nothing
in the repository could reach it either: `@object-ui/app-shell`'s `exports` map declares
only `.` and `./styles.css`, so the file was not addressable as a deep import even from
outside the workspace.

Removing it is not the whole change. Three comments — in `types/src/designer.ts`, `types`'
`designer-field-types.test.ts` (twice) and `fields`' `richtext-cell-renderer-5452.test.tsx`
— cited the bridge as a live corroborating source. Left behind, they would have swapped
dead code for false documentation: three in-repo pointers telling a future reader that this
bridge mediates between the framework field record and `FieldDesigner`, and nothing telling
them it is unreachable. The two that named it as the consumer deriving an editable-subset
check from `DESIGNER_FIELD_TYPES` now name `MetadataFieldsPage`, which does exactly that
with the same idiom and the same `objectui#3017` anchor. The third cited the bridge's
`richtext` → `html` mapping as one of three corroborations that `richtext` stores HTML; the
other two (the showcase seed and the field-type decision tree) are live and carry the point
on their own, so that clause is dropped rather than repointed.

No behaviour changes: nothing imported the module, so there is nothing to migrate.
