---
'@object-ui/core': minor
'@object-ui/app-shell': minor
'@object-ui/plugin-grid': minor
'@object-ui/plugin-list': minor
---

Project every declared `recordIdField`, and refuse an action that names no record

objectstack#8018. An `api` action declaring `recordIdParam` identifies the record
it acts on by a row field — `recordIdField`, default `id`. The grid built
`$select` from the listView columns, `id` and the predicate refs only, so an
action keyed on any other field asked the server for everything except the key
naming its own record. The row arrived without it, and the injection was skipped
silently: the request went out anyway, minus the parameter. A backend reading a
missing selector as "match nothing" then answers success for having changed
nothing, so a record-scoped mutation reports success and does nothing.

Two independent repairs, both in this change:

- **Projection.** `listViewPredicates` (`@object-ui/core`) now also harvests
  `recordIdField` from `rowActionDefs`, `bulkActionDefs` and the object's
  `actions`, spelled as a synthetic `record.<name>` so the one existing harvester
  handles it. Both projection builders — `ObjectGrid` and `ListView` — read that
  function, so both gain the key with no call-site change. The existing guards
  still apply: a name the object does not declare, or one that is not a bare
  identifier, is dropped rather than put in `$select`, because an unknown key
  there is not ignored by every backend.
- **Loud failure.** New `resolveRecordIdParamSeed` (`@object-ui/core`) is the one
  definition of "can this row identify the record?". `useConsoleActionRuntime`'s
  api handler now refuses the dispatch — `{ success: false, error }`, before the
  request — when the row lacks the key, or holds `null` for it. The two refusals
  are worded differently because they point at different repairs: an absent key
  is a projection or read-visibility problem, a null value is a data one. Falsy
  real values (`0`, `''`, `false`) are values and still dispatch.

The second half is what closes the class rather than the common case: a row can
lack the key for reasons projection cannot fix — a server-side read mask that
strips the field regardless of `$select`, a partial payload, a field the
principal cannot read.

Behaviour change worth noting: an action that previously dispatched an
under-specified request now fails visibly instead. That is the point — the old
path could not report the failure it was causing.
