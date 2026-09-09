# @object-ui/plugin-tree

Tree / tree-grid view plugin for Object UI.

Renders a **self-referencing object** as an indented, expand/collapse tree-grid —
the right view for hierarchies of unbounded depth such as **business unit /
org chart**, category trees, menu trees, BOMs, or nested comments. (Grouping
handles *fixed-depth* hierarchies; a tree handles arbitrary depth.)

It registers two component types via the `ComponentRegistry`:

- `object-tree` — the object-bound renderer, and the one an author selects
- `tree` — a view-type alias reached only by host composition (see below)

## Usage

Author an `object-tree` node. Its config keys sit **flat on the node**, and
`ObjectQLComponentSchema` narrows on `type`, so each one is checked against
`ObjectTreeSchema`:

```ts
import type { ObjectQLComponentSchema } from '@object-ui/types';

const schema: ObjectQLComponentSchema = {
  type: 'object-tree',
  objectName: 'business_unit',
  parentField: 'parent',        // single-parent pointer (auto-detected if omitted)
  labelField: 'name',           // indented first column
  fields: ['name', 'manager'],  // additional flat columns
  defaultExpandedDepth: 1,      // 0 = roots only; omit = expand all
};
```

### Config

| Key | Default | Description |
| --- | --- | --- |
| `parentField` | auto-detected | Field holding the parent reference. When omitted, the renderer picks the object's `tree` field (or a lookup/master_detail that references the same object). |
| `labelField` | `name` | Field rendered indented in the first column. |
| `fields` | `[]` | Additional fields rendered as flat columns. |
| `defaultExpandedDepth` | _unset_ | Initial expansion depth. `0` = roots only; unset = expand everything. |

Records whose parent is missing (or points outside the result set) are kept as
roots, so nothing is silently dropped.

### Expansion: the seed and the user's answer

`defaultExpandedDepth` **seeds** expansion; it does not own it. The seeded set is
derived from the forest during render rather than mirrored into component state,
so a tree that expands by default is painted expanded in the first commit that
has rows — there is no frame in which the forest is drawn collapsed
(objectui#8666).

When the record set changes — a refetch, a filter, a host that reallocates the
rows — the seed is recomputed for the new forest. A node the user opened or
closed by clicking its chevron, **and which is still in the forest**, keeps the
user's answer; every other node, a genuinely new one included, takes the seed.
Expansion is per-mount session state: it is not addressable and is not persisted.

### The `tree` view type is host composition, not authoring

`tree` is **not** an authorable view type. Neither `ObjectViewSchema.defaultViewType`
nor `NamedListView.type` admits it — both are the same seven-value union that stops
at `map` — so no authored document selects a tree view, and `ObjectViewSchema`
declares no `views` member at all. The `tree` branch runs only when a **host**
composes `ObjectView` with a `views` prop, whose entries carry `id` and `label`
and are typed `ViewType`. That was ruled deliberate on objectui#5321
(2026-08-20): `tree` and `chart` are recorded as host-composition-only surfaces
rather than added to the authored unions. The per-view `tree` config block that
path reads is host config, so it is not documented here as authoring surface.

The live consumer is the console: it passes stored view records to `ObjectView`
as `views`, and its create-view dialog offers `tree` among the types a console
user can create. To render a tree from authored metadata, write the
`object-tree` node above.

## License

MIT — see [LICENSE](./LICENSE).
