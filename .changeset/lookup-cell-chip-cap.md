---
'@object-ui/fields': patch
---

A multi-value lookup cell no longer grows its row without bound: `LookupCellRenderer`
now shows at most 3 chips and collapses the rest into one muted `+N` chip, the same
cap `UserCellRenderer` has always applied to its avatar stack in the very same file.

Previously the array branch rendered EVERY referenced record as its own chip inside a
`flex-wrap` container. In a grid column that wraps to one chip per line, so a cell
referencing a large set — a production 排班计划 row referencing 60+ work objects — grew
a single row to several screens of height and blew the page layout apart. The same
uncapped rendering reached every surface that resolves through `getCellRenderer('lookup')`:
grid, related lists, gallery, kanban, report and dashboard tables, and the record detail
sections.

The collapsed names stay reachable: the `+N` chip's `title` lists the display names of
the hidden references (resolved through the same option/label/record-name path as the
visible chips), and the record's own detail view remains the place to see the full set.
The first 3 chips keep their per-record links (#4336) and their resolution order —
nothing changes for cells with 3 or fewer references.
