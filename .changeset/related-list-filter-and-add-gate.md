---
'@object-ui/plugin-detail': patch
---

`record:related_list` — the declared `filter` reaches the query, and the Add button answers to the same gate as its dialog

- **`filter` is consumed** (objectstack#7118). The spec declares
  `RecordRelatedListProps.filter` ("additional filter criteria") and this repo
  published it as a registry input, but nothing read it: `RelatedList` built its
  query from `{ [relationshipField]: parentId }` alone, so an authored filter was
  accepted by every gate and silently dropped — the list answered with every child
  of the parent. It is now AND-combined with the parent condition (never
  substituted for it, so an additional criterion can only narrow), lowered through
  the repo's single filter sink so the spec's `[{ field, operator, value }]`
  vocabulary and a composed `dataSource` binding both work. With nothing authored
  the query is unchanged. As a consequence a saved view named through
  `dataSource: { object, view }` no longer contributes its columns/sort/limit while
  its filter is discarded — the list can no longer be wider than the view it names.
  On the legacy raw-URL fallback path, which cannot express an operator, a declared
  filter is refused with a console explanation instead of dropped.
- **The Add button now requires `dataSource`** (objectui#3895), matching the picker
  dialog and the add callback. In hosts that supply no `RecordContext` — Studio
  designer previews, context-free embeds — the button rendered and did nothing at
  all when clicked; the affordance is now withheld where the capability behind it
  is absent.
