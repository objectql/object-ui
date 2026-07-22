---
"@object-ui/app-shell": patch
---

fix(app-shell): map raw `sys_activity` rows before rendering the inbox Activity tab

The top-bar inbox bell's Activity tab (`InboxPopover`) rendered blank rows —
only the relative time showed (`47m ·`), with the actor, summary, and object
name all missing. `AppHeader.fetchPresenceAndActivities` cast the raw
`sys_activity` rows straight to `ActivityItem` without renaming their fields,
so the popover read `a.user` / `a.description` / `a.objectName` while the rows
only carry plugin-audit's `actor_name` / `summary` / `object_name`.

The rows are now mapped onto `ActivityItem` (with `type` normalization, a
`timestamp` fallback, and an empty-`summary` filter), mirroring the mapping in
`useHomeInbox` so the bell and the Home dashboard stay in sync.
