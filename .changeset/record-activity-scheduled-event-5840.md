---
"@object-ui/plugin-detail": patch
---

`record:activity` no longer discards scheduled activities. `sys_activity` rows with
`type: "scheduled"` now map to the `event` feed kind instead of being dropped before any
filter runs, so a not-yet-held meeting reaches the timeline and `types: ['event']` stops
being a permanently empty tab. Held meetings are unchanged: `completed` still maps to
`task` and still hides unless `showCompleted` is set, which is what keeps an upcoming
meeting visible by default while a finished one is not.

The unknown-type default is unchanged and deliberately so — a row whose type nothing maps
is still dropped rather than bucketed into `system`, because rendering an unmeasured kind
as something it is not would be new wrong data rather than recovered data. What changes is
that the drop is no longer silent: an unmapped type now logs one `console.warn` naming it,
once per type. Types the map knows and deliberately excludes (`commented`, `mentioned`,
`login`, `logout`) stay silent, since those are decisions rather than gaps.
