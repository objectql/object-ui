---
"@object-ui/app-shell": patch
---

`AppSidebar` and `UnifiedSidebar` area switchers now adopt the derived area
visibility introduced for `AppSchemaRenderer` in objectui#3311, closing the
same visible-but-empty gap in the console shells (objectui#3319).

Both sidebars inlined their own area switcher without any area-level
filtering, so an area whose navigation items were **all** gated away
(`visible` expression, `requiredPermissions`, `requiresObject` /
`requiresService` capability gates) still appeared in the switcher and
rendered an empty navigation — and a fully gated *first* area was even
auto-activated, landing the user on an empty sidebar.

## What changed

- **Shared predicate, not a second implementation.** Both switchers now call
  `hasVisibleNavigationItems` from `@object-ui/layout` — the exact guards
  `NavigationRenderer` applies per item — so the switcher can never disagree
  with the rendered navigation. In `UnifiedSidebar`, `action` items count as
  content (it wires `onAction`, framework#4509); in `AppSidebar` they do not
  (it wires none).
- **The active area is elected among visible areas only**: first visible by
  default, re-elected when the active area is gated away, and a gating change
  that merely *reveals* an area never steals the user's current selection.
- `areas: any[]` tightened to `NavigationArea[]` in both components.

No authorable area-level key is introduced — visibility stays derived, per
the objectui#3311 ruling.
