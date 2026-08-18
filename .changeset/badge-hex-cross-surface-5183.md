---
'@object-ui/plugin-grid': patch
'@object-ui/plugin-kanban': patch
---

Grid group headers, compact cards and kanban card badges honour an author-declared option hex, matching the grid cell.

objectui#5141 taught the grid's cell renderer (`SelectCellRenderer`) to render an
explicitly declared `options[].color` hex as declared instead of quantizing it
onto one of nine palette families. Four badge call sites in `plugin-grid` and
`plugin-kanban` still resolved through `getBadgeColorClasses`, which returns a
class string and therefore cannot carry a runtime colour — Tailwind can only
emit classes it saw in the source at build time.

The result was worse than the bug it replaced: the same option in the same
object rendered one colour in a desktop grid cell and a different one in the
group header above it or on the kanban card beside it. The pre-#5141 state was
at least uniformly wrong.

All four sites now resolve exactly as the cell does — prefer
`getBadgeHexAppearance(color)` and use its `className` **and** its `style`,
falling back to `getBadgeColorClasses` for palette-family names, no colour, and
every other declaration. The compact card keeps its pipeline-stage heuristic
when the author declared no colour at all.

Two carriers were widened so the style can reach the element, because these
badges are not all plain JSX: `GroupRow` takes a `labelColorStyle` alongside
`labelColorClass`, and a kanban card badge takes `colorStyle` alongside
`colorClass` (`KanbanCard.badges[]`). Both additions are optional and additive;
a badge that carries only a class renders exactly as before. The colours ride
CSS custom properties that the class reads, so a class passed without its style
paints against undefined variables — the two halves have to travel together.

Behaviour is unchanged for every declaration that is not an explicit hex.
