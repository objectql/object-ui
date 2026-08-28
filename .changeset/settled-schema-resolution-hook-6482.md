---
'@object-ui/react': minor
---

New export: `useSettledSchema` — the settled-schema RESOLUTION half shared by
`ObjectKanban` / `ObjectView` / `ObjectCalendar`'s fetch-gate hand copies
(objectui#6482, maintainer ruling Option A). It tracks whether an object's
definition has finished resolving FOR THE KEY THE CURRENT RENDER IS ASKING
ABOUT, returning `{ ready, def }` from one piece of internal state so `ready`
and `def` can never be observed inconsistently and a stale key can never read
as ready — the structural fix for the `ObjectTree` defect (objectui#6481)
where a definition and a separate, one-way-latched "settled" boolean could
disagree for a render after the object changed.

Gate PLACEMENT — which effect branch actually waits on `ready` — stays a
per-component decision and is not part of this hook; see the hook's own doc
comment. Existing hand copies are migrated on their own subsequent cards, not
by this change.
