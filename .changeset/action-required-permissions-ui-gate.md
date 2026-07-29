---
"@object-ui/app-shell": patch
"@object-ui/components": patch
"@object-ui/plugin-detail": patch
"@object-ui/plugin-grid": patch
"@object-ui/react": patch
---

fix(actions): apply the ADR-0066 D4 capability gate on every action surface (framework#3923)

An action declaring `requiredPermissions` is supposed to be one declaration with
two enforcement surfaces: 403 on the server, hidden button in the UI. The UI half
only ever ran inside `ActionEngine.getActionsForLocation` — and the surfaces
`record_header`, `record_more`, `list_item` and `list_toolbar` actually render on
do not go through the engine. They filter their own action lists. So a button
declaring a capability nobody holds rendered, live and clickable, on the record
header, in every grid row menu, and on the list toolbar. For a `type: 'api'`
action pointed at a self-authored endpoint, nothing else was checking either: the
platform's action route (which is where the 403 comes from) never sees that
request.

`page:header`, `action:bar` (business *and* `systemActions`) and the grid's
`RowActionMenu` now apply the same gate, via a shared `useCapabilityGate()` so
the surfaces cannot drift apart. The rule is the engine's, unchanged: hide unless
the caller holds **all** declared capabilities; an empty held set is "holds
nothing" and gates; **unknown** — no action runtime, no resolved capabilities —
fails OPEN, because the server is the authority and hiding a permitted user's
button on missing client data is the worse failure.

The record surface was also feeding the gate nothing to work with.
`RecordDetailView` mounts its own `<ActionProvider>`, which shadows the shell's
for every action on that page, and seeded it with identity only — no
`systemPermissions`. Since unknown fails open, that alone un-gated every
`record_header` / `record_more` / `record_section` action on the one page those
locations exist on. It now forwards the caller's resolved capabilities (and only
once they have actually resolved, so a standalone embed without a
`PermissionProvider` keeps failing open rather than hiding everything).

`useRecordEditable`'s record-level explain probe went out on a bare
`fetch(..., { credentials: 'include' })`. A bearer-token session carries its
credential in the `Authorization` header, not a cookie, so the probe came back
401 on a perfectly valid admin session and the verdict silently failed open —
the hook was inert in exactly the deployments it was written for. It now rides
the host's authenticated fetch (`SchemaRendererProvider`'s `apiFetch`), falling
back to the global one for standalone embeds.
