---
'@object-ui/types': minor
'@object-ui/components': patch
---

Removed the block schema family (objectui#4895, ADR-0049 enforce-or-remove, maintainer
ruling 2026-09-02 — option C1, retire the family in one change, no transition window).

**Breaking on a published surface, deliberately.** These names are gone from
`@object-ui/types`, from both subpaths that carried them:

- `.` (types): `BlockSchema`, `BlockSlot`, `BlockLibrarySchema`, `BlockEditorSchema`,
  `BlockInstanceSchema`, plus the support types with no other reader — `BlockVariable`,
  `BlockMetadata`, `BlockLibraryItem` — and `ComponentSchema`.
- `./zod` (runtime validators): `BlockVariableSchema`, `BlockSlotSchema`,
  `BlockMetadataSchema`, `BlockSchema`, `BlockLibraryItemSchema`, `BlockLibrarySchema`,
  `BlockEditorSchema`, `BlockInstanceSchema`, `ComponentSchema`, and the
  `BlockComponentSchema` union over them — which was also `AnyComponentSchema`'s block arm.

The zod half is the one that mattered. `AnyComponentSchema.safeParse({ type:
'block-library' })` returned **success** on 17.6.0 for a node no page can render, so an
author who copied the documented shape was told green by the shipped validator and then got
the registry's `OBJUI-001` "Unknown component type" panel. Validated-then-broken is worse
than never-validated, because the green light is what the author trusted. All five
discriminants — `block`, `block-library`, `block-editor`, `block-instance`, `component` —
are now **refused**, pinned in `phase2-schemas.test.ts` alongside the theme refusals
retired the same way.

Evidence the family was declared-but-unenforced: zero `ComponentRegistry.register(...)`
sites claimed any of the five keys (positive control `'table'` resolves to two), zero
renderers, and zero readers outside `packages/types/src`. The liveness pass this card's
earlier deferral was keyed to (objectui#6935) established that external consumption of this
package is structurally unmeasurable — the certainly-live control `TableSchema` returns the
same zero external consumers — so the ruling was taken on the evidence in hand rather than
on a deferral whose exit cannot fire.

⚠️ **Not this family, and not touched.** The live slotted record-page vocabulary —
`PageNodeSchema.kind === 'slotted'` with `slots?: PageSlotMap` (`packages/types/src/layout.ts`),
rendered by `usePageAssignment` / `PageBlockCanvas` / `PageBlockInspector` in
`@object-ui/app-shell` — shares the words "block" and "slot" with the retired family and
shares no declaration, type or file with it. Neither is the `type: 'component'` NAVIGATION
item kind (`{ type: 'component', componentRef }`, `NavigationItemSchema` in
`zod/app.zod.ts`), a different declaration in a different module.

`@object-ui/components` carries one forced consequence: `renderers/feedback/empty.tsx`
annotated its `action` child as the retired `ComponentSchema` and now says `SchemaNode`,
the node type `SchemaRenderer` actually takes.

`packages/types/src/blocks.ts` and `packages/types/src/zod/blocks.zod.ts` are kept as
ADR-0049 tombstones exporting nothing, and `block-family-retired-4895.test.ts` pins every
retired name out of them. `content/docs/blocks/block-schema.mdx` is deleted with the family,
and objectui#7023 — the narrower validator-only fix — dissolves into this retirement.
