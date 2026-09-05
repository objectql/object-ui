---
'@object-ui/types': minor
---

`SchemaRegistry['kanban']` stops describing a component it cannot name

`SchemaRegistry` documents itself as "the Single Source of Truth for component
type lookups". Its `'kanban'` entry named `DeclarativeKanbanSchema` — the
authoring/validation face declared in this package — while the renderer
registered for that key is `ObjectKanbanRenderer` in `@object-ui/plugin-kanban`
(`ComponentRegistry.register('kanban', …)`), which consumes that package's own
`KanbanSchema`. The two are distinct dialects, measured member by member: the
plugin face declares 19 members in its own body, the declarative face 7, and
they share three names — `type`, `columns` and `onCardMove`. `onCardMove` has
the same signature on both sides; `columns` is required
`DeclarativeKanbanColumn[]` on one and optional `KanbanColumn[]` on the other,
the two element types sharing five of their six members; the remaining 16
plugin members and the declarative `draggable` / `onCardClick` have no
counterpart across the gap. For this one key the map's value did not describe
the component the key names.

Pointing the entry at the honest type is not reachable from this layer, and
that was measured rather than assumed. Importing `@object-ui/plugin-kanban`
here is a phantom dependency — `check:phantom-deps` rejects it by file and
pair, type-only imports included — and declaring the dependency would close the
cycle `@object-ui/types` → `@object-ui/plugin-kanban` → `@object-ui/types`,
because this package is the zero-workspace-dependency bottom layer.
objectui#6172's ruling (2026-08-31) kept the plugin's bare names rather than
relocating that dialect down here — that is why this entry cannot name the
plugin's type at this commit. That half of the ruling has since been reversed:
objectui#7664's ruling (a) (2026-09-05) rewrites this package's `'kanban'`
arm to the plugin's shape, has `@object-ui/plugin-kanban` conform to it, and
retires the `DeclarativeKanban*` trio; `registry.ts` is on its execution list,
so this entry is scheduled to be re-pointed at the declared type. The value
below is the transitional state under that ruling, not the permanent one.

So the entry now asserts only what this layer can prove, and what BOTH dialects
satisfy: `BaseSchema & { type: 'kanban' }`.

**What this changes for consumers.** `keyof SchemaRegistry` — and therefore the
published `ComponentType` union — is unchanged; `'kanban'` is still a member,
pinned at compile time so it cannot be narrowed away silently. What changes is
the value side of this one key, in two ways, one loud and one silent:

- **Breaking, loudly, for consumers who indexed `SchemaRegistry['kanban']` and
  flowed the value into the declarative face.** Before this change
  `SchemaRegistry['kanban']` *was* `DeclarativeKanbanSchema`, so
  `const s: DeclarativeKanbanSchema = registryValue` compiled. It no longer
  does: the entry lacks the required `columns` member, and that assignment is
  a compile error (TS2741). Nothing in this repository performed such an
  indexed access, so no in-repo code moves — the break is for consumers
  outside it.
- **Silent, for member reads.** `BaseSchema` carries an index signature
  (`[key: string]: any`), so reading the declarative face's own members —
  `columns`, `draggable`, `onCardMove`, `onCardClick` — off the new entry is
  not an error: the reads resolve through the index signature and type as
  `any`. `SchemaRegistry['kanban']['columns']` was `DeclarativeKanbanColumn[]`
  and is now `any`; nothing turns red, the read just stops being checked.
  (Undeclared keys already read as `any` before, through the same signature;
  what changes is those declared members.)

Migration: name the face you actually mean. `DeclarativeKanbanSchema` is still
exported from `@object-ui/types` unchanged for the authoring face, and
`KanbanSchema` from `@object-ui/plugin-kanban` for the rendered one.

This is a breaking change shipped as `minor`: this repository's
version-alignment rule keeps objectui's major pinned to `@objectstack`'s and
ships objectui's own breaking changes as `minor` with the break spelled out in
the changeset body, which is what the two bullets above are.
