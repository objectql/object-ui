---
'@object-ui/plugin-kanban': patch
---

`KanbanSchema` / `KanbanColumn` / `KanbanCard` / `CardTemplate` /
`ColumnWidthConfig` are now the `@object-ui/types` declarations, re-exported
from this package rather than declared in it (objectui#7664, maintainer ruling
(a)). Nothing this package renders changed and every existing import keeps
resolving; what changed is that `safeValidateSchema` in `@object-ui/types` now
validates an authored `type: 'kanban'` document against this very shape, so a
board that validates is a board these renderers draw.

**The shape is not member-for-member what this package declared — it is that
shape plus four members**, counted off `origin/main`'s
`plugin-kanban/src/types.ts` (19 members on `KanbanSchema`, 6 on
`KanbanColumn`, 7 on `KanbanCard`) against the `@object-ui/types`
declarations:

- **`onCardClick` is DECLARED for the first time.** This package's dialect
  never had the member, while `KanbanRenderer` has always forwarded
  `onCardClick={schema.onCardClick}` — an undeclared read (objectui#7742). It
  is declared here as a `#6124` RUNTIME SLOT: callable on the TypeScript face,
  refused by name on the mirror, like the `onCardMove` and `onQuickAdd` beside
  it in the same forward block.
- **Four `?: never` tombstones** carry the retired declarative face's keys
  under the same `'kanban'` key so those spellings keep being refused by name:
  `draggable`, `onColumnAdd` and `onCardAdd` on `KanbanSchema`, and `color` on
  `KanbanColumn`. None of the four was ever a member of this package's dialect;
  each is refused, not silently accepted, because the retired face taught it.
  The full accept-set statement is on the sibling `@object-ui/types` entry.
