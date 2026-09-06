---
---

Documentation and test only. `content/docs/api/schema-reference.md`'s `object-view`
example no longer authors `listViews["my-deals"].default` — a key `NamedListView`
never declared and `ObjectView` never read — and now spells the node-level
`defaultListView` the renderer actually reads. The new pin
`packages/types/src/__tests__/schema-reference-named-list-view-keys-7923.test.ts`
holds that example's `listViews` keys to `NamedListView`'s declared members.
No published behaviour changes (objectui#7923).
