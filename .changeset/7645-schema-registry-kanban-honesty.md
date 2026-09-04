---
'@object-ui/types': minor
---

`SchemaRegistry['kanban']` stops describing a component it cannot name

`SchemaRegistry` documents itself as "the Single Source of Truth for component
type lookups". Its `'kanban'` entry named `DeclarativeKanbanSchema` — the
authoring/validation face declared in this package — while the renderer
registered for that key is `ObjectKanbanRenderer` in `@object-ui/plugin-kanban`
(`ComponentRegistry.register('kanban', …)`), which consumes that package's own
`KanbanSchema`. The two are structurally unrelated dialects: 19 members against
the declarative face's own set, sharing only the `type` tag. For this one key
the map's value did not describe the component the key names.

Pointing the entry at the honest type is not reachable from this layer, and
that was measured rather than assumed. Importing `@object-ui/plugin-kanban`
here is a phantom dependency — `check:phantom-deps` rejects it by file and
pair, type-only imports included — and declaring the dependency would close the
cycle `@object-ui/types` → `@object-ui/plugin-kanban` → `@object-ui/types`,
because this package is the zero-workspace-dependency bottom layer.
objectui#6172's ruling kept the plugin's bare names rather than relocating that
dialect down here, so the gap is permanent by decision.

So the entry now asserts only what this layer can prove, and what BOTH dialects
satisfy: `BaseSchema & { type: 'kanban' }`.

**What this changes for consumers.** `keyof SchemaRegistry` — and therefore the
published `ComponentType` union — is unchanged; `'kanban'` is still a member,
pinned at compile time so it cannot be narrowed away silently. What changes is
the value side of this one key: `SchemaRegistry['kanban']` no longer resolves to
`DeclarativeKanbanSchema`. Code that read members off it gets the base node
shape instead and should name the face it actually means —
`DeclarativeKanbanSchema` is still exported from `@object-ui/types` unchanged
for the authoring face, and `KanbanSchema` from `@object-ui/plugin-kanban` for
the rendered one. Nothing in this repository performed such an indexed access,
which is why this is a correction rather than a break.
