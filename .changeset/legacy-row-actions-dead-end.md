---
"@object-ui/plugin-grid": patch
"@object-ui/core": patch
---

fix(grid): a legacy string row action runs instead of green-toasting a no-op — objectui#2960

A list view declaring `rowActions: ['convert_lead']` rendered a menu item that
performed **zero network requests** and reported success. Where the object also
declared the same action with `locations: ['list_item']`, the row menu showed a
working entry and a dead duplicate of it side by side.

**The name never became an action.** `ObjectGrid` dispatched the legacy form as
`{ type: <action name>, params: { record } }` — the action *name* landing in the
runner's `type` slot, never resolved against the object's action defs. It
matches no built-in type and (absent a handler registered under that exact name)
no handler either, so it fell through to `ActionRunner.executeActionSchema`,
which returned `{success: true, reload: true, close: true}` for a schema with
nothing in it. `handlePostExecution` then fired the green "Action completed
successfully" toast.

Two changes, either of which would have surfaced the bug:

**① `ObjectGrid` resolves legacy names against `objectDef.actions`.** A name
that matches a declared action is promoted to that def and dispatched through
the same path as a `list_item` action — so it actually runs, and it picks up the
def's label, `visible`/`disabled` predicates, param dialog and capability gate,
none of which the string form could carry. A name that matches an action already
rendered as a def is dropped, which is what removes the dead twin. Names that
resolve to nothing are still dispatched by name, since a consumer may have
registered a runner handler under exactly that name.

**② `ActionRunner`'s empty-schema fallthrough fails loudly.** It no longer
reports success for an action it never ran: a dispatch with no registered
handler and no `api`/`endpoint`/`navigate`/`redirect`/`onClick` returns a
failure naming the action. Schema-only shapes that *do* declare something — a
bare `redirect`, an explicit `reload`/`close` — run exactly as before.
