---
'@object-ui/plugin-charts': patch
---

`ObjectChart` now depends on the `fieldOptionLabel` resolver directly instead of
holding it behind a ref, so a chart re-resolves its groupBy option labels when
the resolver genuinely changes (objectui#5587).

The ref existed for a reason that no longer holds. `useSafeFieldLabel()` returned
a fresh object on every render outside an i18next provider, so a direct
dependency made `fetchData`'s `useCallback` identity fresh on every render, and
the effect that depends on `fetchData` refetched on every render — an unbounded
loop. `ObjectChart` worked around that locally with `fieldOptionLabelRef` plus a
`useEffect` keeping it current. `useObjectLabel`'s memo now holds with or without
an i18next instance bound (objectui#5564), so the resolver's identity is stable
on both paths and the indirection buys nothing.

It did cost something, and that is the user-visible half: a ref-hidden dependency
meant `fetchData` did NOT re-run when the resolver changed. A chart mounted
before its `I18nProvider`, or rendered across a language switch, kept serving
groupBy labels resolved by the old resolver until some unrelated dependency
(object name, filter, aggregate) happened to move. It now refetches once on that
transition and shows labels in the active language.

Pinned by `ObjectChart.fieldOptionLabelRefetch.test.tsx`, which counts fetches
across forced re-renders both outside and inside a provider. Reverting
`useObjectLabel.ts` to its pre-objectui#5564 state turns the no-provider case red
(2 fetches instead of 1, alongside React's "Maximum update depth exceeded"), so
the removal is pinned to the fix that unlocked it rather than to a comment.
