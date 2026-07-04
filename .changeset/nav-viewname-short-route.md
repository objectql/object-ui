---
'@object-ui/app-shell': patch
---

Resolve short view names in `/view/<name>` routes instead of silently falling
back to the default view (#2217).

Nav items emit their `viewName` verbatim — usually the short form
(`tabular`) — while canonical view ids are fully qualified
(`showcase_task.tabular`), so nav-generated view links always rendered the
default view with no hint anything was wrong. `ObjectView` now resolves the
requested name in both directions (short → `<object>.<name>`, and qualified →
bare key for legacy embedded listViews), and logs a warning listing the known
view ids when nothing matches instead of swallowing the miss.
