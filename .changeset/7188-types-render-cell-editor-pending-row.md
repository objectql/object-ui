---
'@object-ui/types': minor
---

feat(types): `renderCellEditor`'s context gains `pendingRow` — the persisted row merged with its staged, unsaved edits (#7188)

The inline cell editor's context on `DataTableSchema` (declared by #6882) carried the row
once, as `row` — the **persisted** record. A widget that scopes itself by a sibling field
(a `dependsOn` lookup) had no way to see a parent that was edited in the same row but not
yet saved, so it kept listing candidates for the old parent.

The context now carries the row twice, deliberately:

- `row` — unchanged: the persisted record, what the data source last returned.
- `pendingRow` — **new**: `row` shallow-merged with the row's staged, unsaved edits. The
  same object as `row` when nothing is staged.

`row` was **not** redefined to mean the merged record — that would silently change an
already-published member, and a host that needs the persisted value would have lost its
only source. Both are addressable. The zod mirror's `renderCellEditor` is `z.function()`
and encodes no parameter shape; its description records the delta and names the member
on `DataTableSchema` as the authority. The #6882 exact-shape pin was extended (not
weakened) in the same change, with a control proving the pin can tell the seventh member's
presence from its absence.
