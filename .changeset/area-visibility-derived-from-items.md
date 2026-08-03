---
"@object-ui/layout": minor
---

`AppSchemaRenderer` now derives area visibility from the items inside the
area, closing the visible-but-empty regression the spec 17.0.0 area-key
retirement left behind (objectui#3311, option C of the recorded ruling).

Spec 17.0.0 retired the authorable area-level `visible` /
`requiredPermissions` (`AREA_VISIBLE_RETIRED` /
`AREA_REQUIRED_PERMISSIONS_RETIRED`) — an area is a layout grouping, not an
access boundary — and objectui followed in #3315 by deleting the area
switcher's filter. Correct on the contract, but it changed the navigation
surface: an area whose items are **all** gated away used to disappear from
the switcher and instead rendered as a selectable, empty area.

## What changed

- **Area visibility is now derived, not authored.** An area appears in the
  switcher iff at least one of its navigation items survives the exact
  item-level guards `NavigationRenderer` applies: the `visible` expression,
  `requiredPermissions`, the `requiresObject` / `requiresService` runtime
  capability gates, and — for `action` items — the presence of an `onAction`
  dispatcher (framework#4509: without one they are not rendered, so they
  cannot carry an area either). Separators never count; a `group` counts only
  through its children.
- **The active area is elected among visible areas only.** A fully gated
  first area is no longer auto-activated, and when a gating change hides the
  currently active area the shell re-elects the first visible one. A gating
  change that merely *reveals* an area never yanks the user away from where
  they are.
- **An area with no items at all derives the same way**: no visible item →
  hidden. (Boundary recorded in objectui#3311.)
- New export `hasVisibleNavigationItems(items, options)` from
  `@object-ui/layout` — the predicate behind the derivation, usable by other
  shells that render their own area switchers.

No authorable key is involved anywhere: the platform's `.strict()` area
object still rejects the retired keys, and the derivation — computed from the
same guards that decide what renders — cannot disagree with the rendered
navigation, so there is nothing for a metadata author to get wrong.
