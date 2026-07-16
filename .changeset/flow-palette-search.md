---
'@object-ui/app-shell': minor
---

Flow builder: add a search box, keyboard navigation, and a "Recently used" group to the Add-node palette (#1943). Typing filters across all categories (label + hint + type, case-insensitive), ↑/↓ + Enter inserts the highlighted node, and the empty-query view is topped by a localStorage MRU of recently inserted node types. Works with the server-merged palette, so plugin-contributed nodes are searchable too.
