---
'@object-ui/types': minor
---

`ObjectGallerySchema` and `ObjectDataTableSchema` are members of
`ObjectQLComponentSchema` on both faces — the TS union in `objectql.ts` and the
zod union in `zod/objectql.zod.ts` — so `AnyComponentSchema`, and with it
`validateSchema` / `safeValidateSchema` / `objectui validate`, has an arm for
`object-gallery` and `object-data-table` nodes (objectui#7363).

PR #7355 (objectui#6576) minted both schemas beside the other `Object*Schema`
members and deliberately left the unions alone. Until now a document carrying
either node was refused as matching NO arm — exactly as before the schemas
existed — and a wrong-typed declared key on it could never be diagnosed by name.

Accept-set change on the published validator, both directions, stated plainly:

- WIDENS: a well-formed `object-gallery` / `object-data-table` node now
  validates instead of being refused for having no arm.
- NARROWS in effect: a malformed one (`searchable: 'yes'`, `imageField: 42`,
  `onRowClick` authored as JSON) is now refused BY NAME by the arm, where it was
  previously refused only as "no arm matches".
- TS face: `Extract< ObjectQLComponentSchema, { type: 'object-gallery' } >`
  resolves to `ObjectGallerySchema` instead of `never`; likewise for
  `object-data-table`. `SchemaByType` has no in-repo consumer, and the wider
  `AnySchema` union already carried `BaseSchema`, so nothing narrows there.

No renderer behaviour changes; both nodes rendered before and render the same.
