---
'@object-ui/plugin-dashboard': patch
---

`ObjectPivotTable` now depends on the `fieldLabel` / `fieldOptionLabel`
resolvers directly instead of holding them behind refs, so a pivot re-derives
its header and option labels when the resolver genuinely changes
(objectui#5625).

The refs existed for a reason that no longer holds. `useSafeFieldLabel()`
returned a fresh object on every render outside an i18next provider, so a direct
dependency would have re-run the metadata-derivation effect on every render —
and that effect ends in `setFieldLabelMaps` / `setFieldNameLabels` with freshly
built objects, so each run scheduled the next one: an unbounded derive loop.
`ObjectPivotTable` worked around that locally with `fieldLabelRef` /
`fieldOptionLabelRef` plus a `useEffect` keeping them current.
`useObjectLabel`'s memo now holds with or without an i18next instance bound
(objectui#5564), so both resolvers have a stable identity on both paths and the
indirection buys nothing.

It did cost something, and that is the user-visible half: a ref-hidden
dependency meant the derivation did NOT re-run when the resolver changed. A
pivot mounted before its `I18nProvider`, or rendered across a language switch,
kept showing its top-left header label and its select-option cell labels as
resolved by the old resolver — until some unrelated dependency (the data source,
the object name) happened to move. It now re-derives once on that transition and
renders in the active language.

This is the same removal objectui#5587 made in `ObjectChart`, one package over.

Pinned by `ObjectPivotTable.i18nResolverDeps.test.tsx`, which counts derivations
across forced re-renders both outside and inside a provider, checks that the two
derived state maps settle, and asserts the language-switch re-derivation.
Reverting `useObjectLabel.ts` to its pre-objectui#5585 state turns the
no-provider case red (derivations in the dozens instead of 1), so the removal is
pinned to the fix that unlocked it rather than to a comment.
