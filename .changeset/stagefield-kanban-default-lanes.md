---
'@object-ui/types': minor
'@object-ui/app-shell': minor
'@object-ui/plugin-list': minor
'@object-ui/plugin-detail': patch
---

feat(kanban): default lane field honours the ADR-0085 `stageField` role

Kanban views without an explicit `groupByField`/`groupField` hard-coded their
lane field to the literal `'status'` (in both app-shell's ObjectView options
and plugin-list's ListView fallback) — ignoring the object's declared
lifecycle and even inventing a field the object doesn't have. The default now
resolves through the shared `stageField` detector:

1. explicit view config (unchanged, always wins);
2. the object's `stageField` semantic role;
3. `stageField: false` → **no default lanes** (the status-shaped field is
   declared non-linear; the board renders its empty state until the view
   picks a lane field explicitly);
4. else the shared name/type heuristic (status / stage / state / phase by
   name, then status/stage by type) — never a nonexistent field.

`detectStatusField` moved from `@object-ui/plugin-detail` to
`@object-ui/types` (new export, with the `StatusFieldSource` input type) so
plugin-list and app-shell share the exact semantics; plugin-detail re-exports
it unchanged.

Also fixes ListView's pre-existing rules-of-hooks error while touching the
file: `useListFieldLabel` wrapped `useObjectLabel()` in try/catch (hook-order
desync risk; the hook is provider-safe) — same fix as objectui#2595's
`useFieldLabel`.

Behavior change is limited to kanban views with no explicit lane field on
objects that either declare `stageField` (now honoured), declare
`stageField: false` (now suppressed), or have no status-shaped field at all
(previously grouped by a nonexistent `status` into one "undefined" lane; now
an honest empty state). Objects with a real `status` field — the common case —
are unchanged.
