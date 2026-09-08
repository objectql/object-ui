---
'@object-ui/plugin-kanban': patch
---

Container-aware Kanban column sizing now reaches the swimlane layout, not just the
flat one (objectui#8508).

`KanbanBoardInner` derives a column width from the board's own slot
(`useResizeObserver` on the wrapper that encloses both layouts) so an embedded board —
in a panel, a drawer, a pop-out window — sizes to its slot instead of the viewport. The
docblock over that computation said it "replaces hard-coded `w-[85vw] sm:w-80`", and it
had exactly one consumer: `KanbanColumnView`, on the flat path. The swimlane layout
paints plain column cells itself and has no column components to inherit from, so both
its header cells and its lane cells kept the viewport-relative classes. The sentence was
true of one of the two layouts, and a swimlane board embedded in a narrow slot — exactly
the case the feature exists for — was still sized to the viewport.

Both layouts now take their width from one shared `columnWidthClasses(columnStyle)`
helper plus the same `columnInlineStyle` object, so a container width steps the viewport
classes aside on either path and its absence (SSR, or before the first observation)
falls back to them on either path. Nothing about the flat layout's rendered width
changes; the swimlane header row and its lane rows move together, which is what keeps
the titles over their columns.

Pinned by `swimlaneContainerAwareColumnWidth-8508.test.tsx`, which reads the inline
style rather than a rendered dimension — happy-dom performs no layout — and asserts a
real positive width at each width tier on both layouts, so deleting the viewport classes
without wiring a width cannot pass.
