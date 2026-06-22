# @object-ui/plugin-tree

Tree / tree-grid view plugin for Object UI.

Renders a **self-referencing object** as an indented, expand/collapse tree-grid —
the right view for hierarchies of unbounded depth such as **business unit /
org chart**, category trees, menu trees, BOMs, or nested comments. (Grouping
handles *fixed-depth* hierarchies; a tree handles arbitrary depth.)

It registers two component types via the `ComponentRegistry`:

- `object-tree` — the object-bound renderer
- `tree` — the view-type alias used by `ObjectView` / `ViewSwitcher`

## Usage

```ts
// As a view inside an ObjectView
{
  type: 'object-view',
  objectName: 'business_unit',
  views: [
    {
      type: 'tree',
      tree: {
        parentField: 'parent',        // single-parent pointer (auto-detected if omitted)
        labelField: 'name',           // indented first column
        fields: ['name', 'manager'],  // additional flat columns
        defaultExpandedDepth: 1,      // 0 = roots only; omit = expand all
      },
    },
  ],
}
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
