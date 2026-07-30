---
"@object-ui/plugin-grid": patch
"@object-ui/types": patch
"@object-ui/app-shell": patch
---

fix(grid): an object-declared bulk action runs over the selected records — objectui#3002

A list view declaring `bulkActions: ['push_down']` rendered a selection-bar
button that never ran the action: `ObjectGrid` dispatched the legacy form as
`{ type: <action name>, params: { records } }`, putting the action *name* in the
runner's `type` slot. Since objectui#2996 that fails loudly instead of
green-toasting a no-op, but it still never ran. Nor could the object declare a
bulk action to resolve against — `bulkActionDefs` was passed through from the
view JSON verbatim, never derived from `objectDef.actions` the way
`rowActionDefs` is derived from `locations: ['list_item']`.

**No spec change was needed.** `ActionSchema.bulkEnabled` — *"Whether this
action can be applied to multiple selected records"* — has always been the
declaration; what was missing was a consumer, exactly as framework's own
property-liveness audit recorded (*"engine has `getBulkActions`/`executeBulk`,
but no spec-driven view path calls `executeBulk`"*). So no new `locations`
entry: a list's selection bar is the only surface on which records are
multi-selected, which is what the flag already names. `locations` stays
orthogonal — it places an action's single-record entry, and an action may carry
both (`locations: ['list_item'], bulkEnabled: true` = one row from the kebab, N
rows from the selection bar).

**`ObjectGrid` folds three sources into the selection bar** (new pure
`resolveBulkActions`, the twin of `resolveLegacyRowActions`; `ObjectGrid` is the
single convergence point of all three list callers):

- defs authored inline in the view JSON — unchanged, they win every collision;
- object actions declaring `bulkEnabled: true` — **derived**, which is what
  "declare a bulk action on the object" now means;
- legacy `bulkActions` names — resolved against `objectDef.actions` and
  **promoted** to that def, so they carry the action's label, icon, `visible`
  predicate, confirm text and params instead of a bare humanized name. A name
  matching a def already on the bar is dropped rather than rendered as a dead
  twin; a name matching nothing is still dispatched by name, since a consumer
  may have registered a runner handler under it.

**Execution reuses the existing `BulkActionDialog` model** (params → confirm →
progress → result). A derived def carries the source action under `actionDef`,
and `useBulkExecutor` dispatches it through the action runner once per selected
record with the row attached as `_rowRecord` — so `recordIdParam` injection
behaves exactly as it does for a `list_item` row action. Client fan-out is the
only semantics the single-record action contract supports; a server-side "take
every id at once" variant would need its own spec key and endpoint contract.
Params and confirmation are collected once by the dialog and handed to the
runner as values so it never re-prompts per record, per-record toasts are muted
in favour of the dialog's aggregate result, and a failing record is attributed
in the result list (and error CSV) rather than counted as a success.

Also fixed: the bar rendered legacy string buttons **only when no defs
existed**, so a view mixing both silently lost half its buttons. After the fold
the two lists are disjoint, and both render.
