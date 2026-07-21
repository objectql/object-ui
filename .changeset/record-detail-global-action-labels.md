---
"@object-ui/i18n": patch
---

fix(i18n): apply globalActions label overlays to actions surfaced on a record-detail action bar (objectui#3372)

On a record-detail action bar the caller passes `objectDef.name` for **every**
action, so a `globalAction` surfaced there (e.g. `log_call`) looked up
`objects.<obj>._actions.<action>.label`, missed, and leaked the English
metadata literal ("Log a Call") instead of its `globalActions.<action>.label`
overlay ("记录通话"). Object-owned actions on the same bar translated fine,
which is what made the gap visible.

`useObjectLabel()`'s action resolvers now mirror the canonical
`@objectstack/spec` resolver (`system/i18n-resolver.lookupActionField`): when an
action is object-scoped, the object key still wins, but `globalActions.<action>.*`
is consulted as a fallback before returning the literal. This applies uniformly
to `actionLabel`, `actionConfirm`, `actionSuccess`, `actionDescription`,
`actionResultDialog`, `actionParamText`, and `actionParamOptionLabel`, so a
globalAction resolves the same on a record-detail action bar as it does
everywhere else. App-namespace discovery also recognises a `globalActions`-only
bundle (one with no object/field entries).
