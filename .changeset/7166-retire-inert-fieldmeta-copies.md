---
'@object-ui/plugin-grid': patch
---

`ObjectGrid` no longer copies `descriptionField`, `lookupColumns` or `lookupFilters` onto a
relational column's `fieldMeta` (objectui#7166). No behaviour change — all three still reach
the inline lookup picker, by a different seam.

`applyRelationalMeta` writes the copy set onto the `fieldMeta` that `generateColumns` hands
to `<CellRenderer>` as the `field` prop — six JSX passes across the three column-building
paths, and nowhere else. For a relational column that resolves to `LookupCellRenderer`,
which reads exactly `reference_to`, `reference`, `display_field`, `displayField`,
`reference_field` and `options`; a `user` column resolves to `UserCellRenderer`, which
destructures `{ value }` and reads no field meta at all. Measured by receiver rather than by
count: `packages/fields/src/index.tsx`, the file holding **every** cell renderer, contains
**zero** occurrences of the three retired keys, against a control of 22 occurrences of the
`display_field` / `displayField` / `reference_to` spellings the cell does read.

Their only readers off a field meta are `LookupField` and `UserField` — the two **editor**
widgets — and the grid's inline editor does not receive this bag. `renderCellEditor` looks
the field up in the object schema and spreads the whole def into the widget
(`{ name: ctx.column.accessorKey, ...fieldDef }`), so every key a def carries reaches
`LookupField` whether or not it is copied. The copies were dead writes: the objectui#6711
(`reference_to_field`) and objectui#6874 (`titleFormat`) class, arriving from the opposite
direction — those keys had no *declaration*, these have no *reader on this path*.

Two of the three, `descriptionField` and `lookupColumns`, were **added** by objectui#6875 as
its fix, classified from a read-set derivation alone. Its third key, `displayField`, is
genuinely delivered and stays copied — and it is the one that arrived with a rendering test.
⭐ The generalisable lesson, now recorded in both docblocks: **a derivation establishes that
a consumer READS a key; it does not establish that a given BAG is how the consumer gets it.**

- New `__tests__/relationalMetaCopySet-7166.test.tsx` renders both directions. The **cell**:
  four lookup columns over one referenced record, differing only in the key under test, all
  resolve the same text, while the `displayField` control column resolves something else —
  the control is what makes the three zeros readings rather than a fixture that never reached
  the lookup path. The **editor**: each retired key still takes effect in the inline picker
  with the copy set no longer carrying it — `descriptionField` drives the secondary line,
  `lookupColumns` shapes the picker columns, `lookupFilters` scopes the candidates — each
  against a sibling control column that declares nothing.
- The three snake_case `legacy-alias` spellings — `description_field`, `lookup_filters`,
  `id_field` — have the same reader-side verdict and are **deliberately kept**. They are
  recorded as legacy aliases precisely because a host `DataSource` outside these repos may
  hand-feed them; that is a producer-side argument, untouched by this reader-side
  measurement. Their verdict is now recorded on the table with the open producer question
  stated, so the next pass inherits a measurement instead of a silence.
- ⛔ The derivation gate cannot enforce this retirement, and now says so. Its read set is a
  union over three consumers, two of which are not fed this bag, so all three retired keys
  remain in it and every derived assertion passes whichever verdict they carry. Their absence
  is pinned by an explicit hand-written assertion plus the rendering test. Re-scoping the
  derivation around the cell alone is a design change to objectui#6875's mechanism and is
  filed, not made here.
- The gate is strengthened, not weakened: every `deferred` verdict is now mechanically proved
  spec-declared against the installed `FieldSchema`, and the sibling pins
  (`relationalMetaCopySet-6711` / `-6874`) turn the retired `lookupFilters` into a live
  negative assertion on a fixture that still declares it.
