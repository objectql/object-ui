---
'@object-ui/plugin-view': patch
---

`ObjectView` now forwards the canonical `table.columns` on the non-grid paths, not only on the grid one.

`ObjectViewSchema.table` inherits from `ObjectGridSchema`, where `columns` is the
canonical spelling and `fields` carries `@deprecated Use columns instead`. Only
one of the file's three field-list read points consulted `table.columns` — the
grid one. `generateViewSchema`'s shared `baseProps` and the delegated
`renderListView` schema both read `table.fields` alone, so an author who wrote
`table: { columns: [...] }` on a non-grid view got an empty field list from a
schema that compiled and read correctly. Same silent-success shape as
objectui#5102, different mechanism: not a whitelist that knows only legacy
spellings, but one that disagreed with itself between two rendering paths.

Both sites now read the canonical key first and keep the deprecated one as a
working alias, exactly as objectui#5102 settled it for its four pairs. Nothing
is translated or reshaped on the way through, and precedence is unchanged: a
named view's `columns`, then the active view's, then the `table` segment.

Where this is observable, measured rather than assumed: `object-kanban` (the
card fields) and `object-tree` (its flat columns) consume the shared
`baseProps` field list, and the delegated `list-view` consumes `columns`.
`object-gallery`, `object-calendar`, `object-timeline`, `object-gantt` and
`object-map` read no field list off their schema at all, so the forwarded value
is inert there — before this change and after it.
