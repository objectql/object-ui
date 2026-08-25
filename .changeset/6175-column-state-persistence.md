---
'@object-ui/components': patch
'@object-ui/plugin-grid': patch
---

Column width and order that a user drags in `ObjectGrid` now actually persist
(objectui#6175). Both halves of `saveColumnState`'s only two call sites were dead, so a
drag was written nowhere — not to `localStorage`, not through `onColumnStateChange` to the
host's `dataSource.updateViewConfig`. The saved state was read back correctly forever; it
was simply never written.

Two independent breaks, one per package:

- **`@object-ui/components`** — `DataTableSchema` has declared
  `onColumnResize?: (columnKey, width) => void` all along, and `data-table.tsx` invoked it
  **nowhere**: the resize drag updated the table's local `columnWidths` state and stopped
  there. It now reports the settled width once, at `mouseup`. Once, deliberately — the host
  turns this callback into a write to shared view config, so a per-`mousemove` callback
  would be a write storm.
- **`@object-ui/plugin-grid`** — `ObjectGrid` emitted `onColumnReorder` (singular) while the
  renderer invokes the near-duplicate `onColumnsReorder` (with the `s`), a different declared
  key with a different signature. The producer now emits the spelling the renderer actually
  invokes, mapping the reported `TableColumn[]` to the `accessorKey` order `columnState`
  stores.

**Nothing is retired.** Both spellings remain declared on `DataTableSchema`;
`onColumnReorder` stays declared and stays unwired, exactly as the `RuntimeOnlyDeclared`
ledger in `zod-mirror-parity.test.ts` records it. Which of the two survives is a
declared-surface ruling that stays open and is deliberately not settled here.

⚠️ Behavioural note for hosts: `onColumnStateChange` now fires where it previously never
did, which means `dataSource.updateViewConfig` is now reached on a column drag. That call
was unreachable by this path before, so any permission gate on that write now sees traffic
it never saw.

The renderer's resize/reorder gestures, the inbound seeding of `columnState`, and the
declared surface are all unchanged.
