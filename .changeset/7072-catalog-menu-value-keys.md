---
---

Internal only, no release: the four overlay-menu fixtures in
`examples/schema-catalog` no longer author a `value` key on their menu items.

Twenty-one menu items across `components-overlay-menubar/application-menubar`
(11), `components-overlay-context-menu/basic-context-menu` (4),
`components-overlay-dropdown-menu/basic-dropdown-menu` (3) and
`components-overlay-dropdown-menu/with-icons` (3) carried `"value"`. No arm of
the shipped `MenuItem` union declares it — `MenuCommandItem`
(`packages/types/src/overlay.ts:363-401`) declares `label`, `icon`, `disabled`,
`onClick`, `shortcut`, `children`, `separator?: false` and a `type?: never`
tombstone; `MenuDividerItem` (`:409-419`) declares `separator: true` and the
same tombstone. Neither declares `value`, and none of the three menu renderers
under `packages/components/src/renderers/overlay/` reads one.

Nothing rendered differently before or after, which is the point: `MenuItemSchema`
(`packages/types/src/zod/overlay.zod.ts:147-168`) builds its union from bare,
non-strict `z.object`s, so zod stripped the key and reported success. The key
had been inert and invisible since it was authored, and the catalog is a
declared AI few-shot retrieval source, so an inert key there is a spelling the
next author copies.

The keys are deleted rather than declared: nothing reads `value`, and
objectui#6523 deliberately narrowed this union rather than widening it. No
published package source, no schema, no renderer and no type was touched — the
diff is four JSON fixtures in a `private: true` example package.
