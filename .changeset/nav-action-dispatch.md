---
"@object-ui/layout": minor
"@object-ui/app-shell": minor
---

Navigation `action` items actually run now (framework#4509).

A `type: 'action'` nav item rendered, gated like any other item, and did
**nothing** when clicked. `NavigationRenderer` dispatches such a click to an
`onAction` prop it expects the host shell to supply — it deliberately never
reads `item.actionDef` itself — and no shipped sidebar supplied that prop. So
`actionDef.actionName` reached no dispatcher: an author could put an action in
the menu, watch it render with its icon and label, and never find out that
clicking it was a no-op. The framework's liveness ledger recorded this as the
single gap in the AppSchema navigation surface.

**New `useNavActionDispatch`** (`@object-ui/app-shell`) resolves the nav item's
`actionName` against `action` metadata at click time — the same source
`DeclaredActionsBar` reads for a record toolbar — and dispatches the resolved
definition through `useAction()`. `UnifiedSidebar` now passes it. No new
provider is involved: the sidebar already renders inside `ConsoleShell`'s
`GlobalActionRuntimeProvider`, so nav actions get the fully-wired console runner
including the confirm, param-collection, result and navigate dialogs. A declared
`params` array becomes the runner's param-dialog input, and the nav item's own
`actionDef.params` is passed as the value bag, so a menu entry can pre-fill the
action it launches.

Nav actions are inherently **global**: `ActionNavItemSchema` is strict with
exactly `{ actionName, params? }` and carries no `objectName`, so resolution is
by name alone and no record context rides along.

**Behaviour change:** a shell that passes no `onAction` no longer renders
`action` items at all, instead of rendering them dead. This mirrors the existing
capability guards — an item the host cannot serve is hidden — and it makes the
omission diagnosable: a missing prop now shows up as "my action item is gone",
which leads to the prop, rather than "clicking does nothing", which for three
releases led nowhere. Every failure at dispatch time (an unnamed item, an
unresolvable action, a throwing action) warns and toasts instead of returning
silently.
