---
'@object-ui/types': minor
---

One authority for `KanbanSchema` / `KanbanColumn` / `KanbanCard`: the bare names
now belong to `@object-ui/plugin-kanban` (objectui#6172, closing the
cross-package half of objectui#6155).

**Breaking, deliberately — six published names are removed from
`@object-ui/types`.** Per this repo's own rule a breaking change ships `minor`,
with the break spelled out here.

| removed from | old name | new name |
| --- | --- | --- |
| `@object-ui/types` | `KanbanSchema` | `DeclarativeKanbanSchema` |
| `@object-ui/types` | `KanbanColumn` | `DeclarativeKanbanColumn` |
| `@object-ui/types` | `KanbanCard` | `DeclarativeKanbanCard` |
| `@object-ui/types/zod` | `KanbanSchema` | `DeclarativeKanbanSchema` |
| `@object-ui/types/zod` | `KanbanColumnSchema` | `DeclarativeKanbanColumnSchema` |
| `@object-ui/types/zod` | `KanbanCardSchema` | `DeclarativeKanbanCardSchema` |

Nothing else moved: every member, every optionality and the Zod mirror's whole
accept/reject behaviour are byte-for-byte the shape they were. `SchemaRegistry`
still maps `'kanban'`, `ComplexSchema` still carries the arm, and
`safeValidateSchema` accepts and refuses exactly what it did before.

**Migration.** `import type { KanbanSchema } from '@object-ui/types'` becomes
either of two things, and which one you want is the whole point of the rename:

- authoring a board that a **registered renderer** will draw — import the bare
  name from `@object-ui/plugin-kanban`, which is unchanged;
- annotating or validating the **declarative** shape `@object-ui/types` mirrors
  in Zod — import `DeclarativeKanbanSchema` (or the Zod
  `DeclarativeKanbanSchema` from `@object-ui/types/zod`).

**Why this direction.** The two declarations were structurally unrelated
dialects sharing three names, and `@object-ui/types` is the declared
zero-workspace-dependency bottom layer, so it cannot re-point at a plugin —
convergence had to remove a name from one side or the other. All four
registered kanban renderers (`kanban`, `kanban-ui`, `kanban-enhanced`,
`object-kanban`) consume the plugin's dialect and none consumes this one, and
objectui#6086 measured what happens when the bare name is the copy no renderer
reads: an IDE or agent auto-import silently authors a board that renders
nothing — a confident empty board rather than an abstention. So the surviving
bare name is the one a renderer honours.
