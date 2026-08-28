---
---

Internal only, no released behaviour change: `plugin-view`'s `ObjectView` no
longer declares a `handleRefresh` callback that nothing referenced.

The callback bumped `refreshKey` but was never passed to the toolbar, exposed on
a handle, or wired to any control — it advertised a refresh entry point the
component does not have, which cost objectui#4549 a detour to rule out. The
reachable refresh paths are unchanged (`onMutation` auto-subscribe, delete, bulk
delete, form success), and the real toolbar Refresh button continues to live in
`plugin-list`'s `ListView`, reached through `renderListView`.
