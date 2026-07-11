---
"@object-ui/plugin-form": patch
---

fix(plugin-form): honor `userActions.edit` on managed objects instead of blanket-disabling every field (ADR-0092 D4)

`ObjectForm` disabled every field on any non-`platform` lifecycle bucket
(config / system / append-only / better-auth) — a defensive default from when
those objects had no generic edit affordance at all. Now that an object can
OPEN per-record editing via `userActions.{edit,create}` (framework ADR-0092 D4
— e.g. `sys_user` exposing its `name`/`image` profile fields), the blanket
lock lifts for the current mode when its affordance is `true`, and each
field's own `readonly` flag decides. Managed buckets still default the
affordance off, so an object that doesn't opt in is unchanged. The server-side
identity write guard remains the real boundary; this is UX only.
