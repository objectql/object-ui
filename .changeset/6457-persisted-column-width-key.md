---
'@object-ui/plugin-grid': patch
---

ObjectGrid now restores a persisted column width on the ungrouped path — the stamp key was
`size`, which nothing downstream reads (objectui#6457).

Resize a grid column and reload: the width came back. It was written to `localStorage`
(and reported to the host, which persists it through `dataSource.updateViewConfig`), read
back into `columnState.widths`, and stamped onto the column — as `size`. `TableColumn`
declares `width`, and `data-table` resolves a column's width at all four of its sites as
`columnWidths[accessorKey] || col.width || autoSizedWidths[accessorKey]`; it reads no
column-level `size` anywhere, and ObjectGrid never passes a `columnWidths` prop down. So
the round trip completed and was discarded at the last hop, and the column fell back to
the char-estimate auto width. The `persistedColumns` map now stamps `width`.

The correct key was not a judgement call: the **grouped** path in the same component reads
the same `columnState.widths` and has always stamped `width`, and it worked. One path was
out of step with its sibling — so this restores a convention rather than teaching
`data-table` a second spelling. `TableColumn` is not edited: the consumer's declaration
was the correct one. Precedence is unchanged and needs no change — a persisted width still
loses to an in-session resize and still beats auto-sizing.

Two things stop it recurring. The map's callback is no longer `(col: any)`: typed as
`ObjectGridColumn` (`TableColumn & …`, declared since objectui#6004), a stray `size` here
is now a compile error instead of a silent, user-visible drop — the `any` was what let the
wrong key cross a boundary that had already declared the right one. And the new pin is the
**inbound** half — a persisted width seeded through both channels, asserted at the rendered
header cell. The pre-existing suite asserted only the outbound half, which passes on the
broken code, because the write is exactly what was wrong; that is the measured reason this
shipped.
