---
'@object-ui/app-shell': minor
---

A dashboard header `modal` action's `target` names a PAGE, only — DashboardView's second copy of the prefix convention retires

`DashboardView` installed its own `onModal` handler on the dashboard's
ActionRunner, independent of `useActionModal`, carrying a second live copy of
the `create_`/`new_`/`add_`/`edit_`/`update_` prefix convention:
`{ actionType: 'modal', actionUrl: 'create_opportunity' }` was split into the
object `opportunity` in `create` mode, and any other string became
`{ objectName: <the target> }` — an object create form, unconditionally. There
was no page resolution at all on this path.

Both limbs retire under the same maintainer ruling that retired them in
`useActionModal` (objectstack#6739, 2026-08-09; the `useActionModal` side
shipped in #4764). The view no longer implements the contract — it installs the
SHARED `useActionModal` handler, the same one `RecordDetailView` and the console
runtimes install, so a dashboard header button, a record-header action and a
console list action now resolve, refuse and REPORT identically.

The convention's self-declared producer — the handler's comment claimed it
served "server-driven dashboard schemas" emitting `verb_object` names — was
enumerated before deletion and does not exist. No dashboard in either repo's
corpus authors a `header.actions[]` entry at all, let alone a prefixed one.

**Breaking surface.** A dashboard header action with `actionType: 'modal'` whose
`actionUrl` names an OBJECT (bare, or under a verb prefix) no longer opens that
object's create/edit form. It is refused, with a diagnostic naming the refused
target and pointing at the replacement. Opening an object's form from a
dashboard header is `actionType: 'form'` with an `object.view` FORM-view target
— `actionType` accepts the full action-type enum, so that shape reaches this
surface too, and it is validated end-to-end.

A header action whose target names a real page now resolves and opens that page
in the dialog — which this view could not do before at all.
