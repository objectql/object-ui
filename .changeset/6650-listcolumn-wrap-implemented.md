---
'@object-ui/components': patch
'@object-ui/plugin-grid': patch
'@object-ui/types': patch
---

Implement `ListColumn.wrap` — a column that says it wraps now actually wraps
(objectui#6650, maintainer ruling 2026-09-02, Option B).

`@objectstack/spec` declares `ListColumn.wrap` and describes it to authors as
"Allow text wrapping", and `packages/plugin-grid/README.md` shows it in its
authored-column example. No renderer anywhere implemented it. Long cell text
stayed clipped to one line, with no error, no warning and no feedback of any
kind — a promise made at authoring time and silently broken at render time.

**What changes.** A `data-table` column with `wrap: true` renders its cell body
`whitespace-normal break-words` instead of the default `truncate`, so long text
flows onto further lines and the row grows to fit. `ObjectGrid.generateColumns()`
forwards the authored key into the column slot, and `TableColumn` declares it, so
the key is honoured whether it is authored on a spec list view or directly on a
`data-table` node. `ObjectGrid`'s own `LinkCell` — the record link that column one
of almost every grid renders through — honours it too, because its own `truncate`
would otherwise clamp the text back to one line inside a cell body that was
willing to wrap. `@object-ui/types`' zod mirror carries the key as well; without
that the non-strict mirror would silently strip an authored `wrap` on the parse
road, which is the same "renderer honours what the declaration refuses" gap
objectui#6424 and objectui#6425 closed for their keys.

**Nothing changes for anyone not authoring the key.** `wrap` absent or `false`
renders exactly what shipped before, pinned as a control rather than assumed, and
the link cell's default markup is byte-identical to what it was.

**Precedence, where the two keys conflict.** `fitContent` WINS over `wrap`. A fit
column is `width:1%` with no `minWidth`/`maxWidth` clamp, so the auto table layout
sizes it from its content alone, and `whitespace-nowrap` is what holds that
content's min-content width at its max-content width — one line. Drop nowrap and
min-content falls back to the longest word, so honouring `wrap` there does not
wrap the column, it collapses it: measured in Chromium with the cell shape
reproduced exactly, 463.9px wide on one line with nowrap against 70.9px wide over
ten lines without it — 6.5x narrower and 5.9x taller. The keys do not compose, and
the one that yields is the one whose outcome nobody asked for.

The static `table` renderer does not gain the key: `StaticTableColumn` tombstones
it, so an author who writes `wrap` there is refused loudly at parse time with the
remedy named, rather than having it silently stripped.
