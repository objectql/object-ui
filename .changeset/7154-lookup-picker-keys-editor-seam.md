---
---

Measurement-only change in `@object-ui/plugin-grid`: objectui#7154 reported that
`ObjectGrid`'s inline lookup picker never receives `multiple`, `allowCreate`,
`lookupPageSize` or `dependsOn` because they are not on the relational copy set.
Rendered against the grid's own inline editor, all four already take effect —
the copy set is not the route.

`applyRelationalMeta` writes onto the `fieldMeta` handed to `<CellRenderer>`,
the read-only cell. The inline editor is a different seam: `renderCellEditor`
looks the field up in the object schema and spreads the whole def into the
widget, so every key a def carries reaches `LookupField` whether or not it is
copied. Both halves read `objectSchema.fields[name]`, so copying could never
rescue an editor the schema read did not already serve.

- New `__tests__/lookupPickerKeys-7154.test.tsx` renders each key against a
  control column differing only in that key: `multiple` accumulates two picks
  ("2 selected") where the control replaces; `allowCreate: false` removes the
  quick-create entry the control offers; `lookupPageSize: 3` scopes the picker
  dialog to 3 rows against a control of 10; `dependsOn` arrives and gates.
- The four verdicts stay `deferred` — flipping them would write members onto a
  bag whose consumer does not read them, the shape objectui#6711 and
  objectui#6874 retired — with the measurement now in their notes.
- Corrected the docblocks and the three `applyRelationalMeta` call-site comments
  that claimed the inline picker reads this bag; that claim is what the card was
  filed against.

No behaviour change.
