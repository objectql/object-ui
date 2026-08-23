---
---

Tests only — this publishes nothing, declared explicitly with an empty frontmatter
rather than left undeclared. No package `src/` is touched; the only file added is
`packages/app-shell/src/views/InterfaceListPage.hollowOverlayHydration.test.tsx`.

objectui#5773 — pins the intended post-objectui#5233 behaviour at the seam the card
named: `InterfaceListPage`'s hollow-view hydration effect merging a personalization
overlay row it fetched through `listViewOverrides`/`getView` (the same undocked-narrowing
read path `narrowPersonalizationOverlay`'s docblock in `packages/data-objectstack/src/index.ts`
describes).

Reachability was measured, not reasoned about — constructed through the REAL
`ObjectStackAdapter` write (`updateViewConfig`/`buildPersistedViewBody`, the same seam
`ObjectView.overlayPatchOnly.test.ts` uses) and the REAL `InterfaceListPage` render, not a
hand-written override fixture. Two cases:

- A hollow ADR-0017 expansion item (system view, no `columns`) plus the CURRENT
  (post-#5233) thin overlay row a toolbar toggle writes today: the page renders
  `defaultColumnsFromObject`'s defaults — reachable, and the intended behaviour per the
  card's disposition (an overlay was never a legitimate source of a view body).
- The same hollow view with a PRE-#5233 fat overlay row (the shape an install that has
  not touched this view since before the fix is still carrying, per
  `ObjectView.overlayPatchOnly.test.ts`'s own "PRE-FIX" framing): the page renders the
  frozen stale columns instead — a control proving the pin above discriminates a real
  hydration-effect outcome rather than passing vacuously.

Confirmed load-bearing by reverse verification: with the hydration effect's guard
short-circuited (`if (true) return;`), the CONTROL case flips from the frozen `["status"]`
to the un-hydrated defaults `["name","status"]` — the assertion depends on the fetch +
merge actually running. No production code changed; `InterfaceListPage.tsx`'s hydration
effect already behaves this way today, this was untested rather than unreachable.
