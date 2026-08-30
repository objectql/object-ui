---
'@object-ui/plugin-dashboard': patch
---

Feed the lookup cells in `ObjectDataTable` and `RecordDetailDrawer` their reference target,
so schema-aware display-name resolution and drill-through links engage for the first time
(objectui#6694).

Both widgets build their cell meta with `buildFieldMeta` and render it through
`renderFieldValue` → `getCellRenderer` → `LookupCellRenderer` (`@object-ui/fields`). That
renderer resolves its target from `field.reference_to || field.reference`, and `FieldMeta`
carried neither spelling — nor `display_field`. So the renderer resolved `undefined` and two
things failed, independently and both silently:

- `useRefObjectSchema` never loaded the referenced object's schema, so the ADR-0079 /
  objectui#2357 resolution never ran and every cell fell back to `pickRecordDisplayName`'s
  generic `.name` / `.title` heuristic. Quiet, because that heuristic usually still produces
  a readable name — it diverges only when the referenced object's display field is not
  literally `name` / `title`, and then it silently shows the wrong one.
- `ReferencedRecordLink`'s `objectName` was always `undefined`, so `navigable` was always
  `false` and no lookup cell in either widget ever rendered a real anchor — no
  drill-through, no middle-click-new-tab, no copy-link. Quiet, because the cell still
  rendered its value as plain text.

This RESTORES intended behaviour rather than adding surface. `ReferencedRecordLink` was
placed in the shared cell renderer precisely so every surface would get the affordance once
("Both surfaces resolve through `LookupCellRenderer`, so the affordance belongs here,
once"), and `plugin-grid`'s `ObjectGrid` has fed it all along via `applyRelationalMeta` at
all three of its column-building call sites. These two widgets simply never adopted that
copy. Nothing new is authorable: the keys come off the OBJECT SCHEMA field def authors
already write, never off a column override — the distinction objectui#6597 measured when it
retired `referenceTo`, and the reason this needs no new column hold.

The copy is made once in `buildFieldMeta`, the seam both widgets funnel through, so the two
surfaces cannot drift — which is what that module exists for.

⚠️ The copy set is three keys where `ObjectGrid`'s `RELATIONAL_META_KEYS` is nine, and the
difference is measured per key, not preferred. The grid's cells are EDITABLE, so its extra
keys drive the inline picker's query (`LookupField` / `UserField` read `id_field`,
`description_field`, `lookup_filters`, `lookupFilters`); these two widgets are read-only and
their render path ends at a cell renderer. `packages/fields/src/index.tsx` reads exactly
`reference_to`, `reference` and `display_field` off a cell's `field` prop; `titleFormat` is
never read off a field meta at all (its readers take it off the object schema, which arrives
here through `useRefObjectSchema(reference_to)`), and `reference_to_field` has zero member
reads anywhere in the repo. Copying the other six would mint six members written on every
call and read by nothing — precisely what objectui#6625 (`decimals`) and objectui#6597
(`referenceTo`) retired from this same file.

No published type widened: `FieldMeta` is internal to the package — it is not re-exported
through the barrel (`dist/index.d.ts` names neither it nor `recordFields`) and the `exports`
map publishes only `"."`, so Node refuses `@object-ui/plugin-dashboard/recordFields` with
`ERR_PACKAGE_PATH_NOT_EXPORTED`.

Behaviour note for existing dashboards: a lookup cell whose referenced object declares a
`nameField` other than `name` / `title` will now show that declared name instead of the
heuristic's pick, and valued lookup cells become links wherever the host publishes
`recordHref`.
