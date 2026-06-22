---
"@object-ui/plugin-tree": minor
"@object-ui/types": minor
"@object-ui/plugin-list": minor
"@object-ui/plugin-view": minor
"@object-ui/app-shell": minor
"@object-ui/console": minor
---

feat(plugin-tree): add a `tree` / tree-grid object view type

Renders a self-referencing object as an indented, expand/collapse tree-grid —
the right view for arbitrary-depth hierarchies (business unit / org chart,
category trees, BOMs, nested comments) that fixed-depth grouping can't express.
New `@object-ui/plugin-tree` package (`object-tree`/`tree`), `tree` added to the
`ViewType` union, and dispatch wired through plugin-list `ListView` +
app-shell `ObjectView` (the console path).
