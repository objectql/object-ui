---
'@object-ui/plugin-kanban': patch
---

`KanbanSchema` / `KanbanColumn` / `KanbanCard` / `CardTemplate` /
`ColumnWidthConfig` are now the `@object-ui/types` declarations, re-exported
from this package rather than declared in it (objectui#7664, maintainer ruling
(a)). Member for member the shape is what this package declared, so nothing
this package renders changed and every existing import keeps resolving; what
changed is that `safeValidateSchema` in `@object-ui/types` now validates an
authored `type: 'kanban'` document against this very shape, so a board that
validates is a board these renderers draw.
