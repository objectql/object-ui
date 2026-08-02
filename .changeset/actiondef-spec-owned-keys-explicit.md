---
"@object-ui/core": minor
---

Declare the 18 spec-owned action keys `ActionDef` had been absorbing silently.

`ActionDef` ends with `[key: string]: any`, so it accepted any key of any type —
a typo (`targt`) and a retired spec key (`execute`) both type-checked, then the
runner silently bound no handler (the #2169 "Mark Done does nothing" shape).
Step 1 (objectstack#4075) made that audible with a dev-mode warning. This is
step 2: the keys the warning identified as legitimate are now real fields.

- **18 keys promoted to explicit optional fields** — `ai`, `aria`, `bodyExtra`,
  `bodyShape`, `bulkEnabled`, `component`, `icon`, `locations`, `mode`,
  `objectName`, `order`, `recordIdField`, `recordIdParam`, `requiredPermissions`,
  `requiresFeature`, `shortcut`, `variant`, `visible`. Every type is **derived**
  from `@objectstack/spec`'s `ActionInput` (`SpecActionInput['locations']`, …),
  never hand-copied: a hand-written duplicate of a spec shape is a second
  contract that drifts, which is the failure this issue is about. Wrong-typed
  values are now compile errors — `order: 'first'`, `variant: 'chartreuse'`,
  `locations: ['nope']` — where before they were absorbed silently.
- **Derived from `z.input`, not `z.infer`.** `ActionSchema` is a `ZodPipe` whose
  transform narrows `visible` from `string | { dialect, source }` to the
  envelope alone. This runner consumes authored/stored rows, which are
  rehydrated unparsed, so it sees the input shape; deriving from the inferred
  `Action` would have rejected the raw-string predicate `ActionEngine`
  explicitly supports.
- **Three `as any` casts deleted** in `ActionEngine` — `visible` and
  `requiredPermissions` at the location filter, `locations` at registration.
  They existed only because the fields were undeclared.
- **Four objectui-dialect keys marked `@deprecated`** with the spec spelling to
  use instead — `actionType` (→ `type`), `api` and `endpoint` (→ `target`;
  `executeAPI` already resolves `api || endpoint || target`), and `navigate`
  (→ flat `target` / `openIn`). Only these four: the remaining dialect keys are
  runner mechanics (chaining, toasts, post-execution reload/close) with no spec
  counterpart, and pointing them at a spelling that does not exist would be
  worse than leaving them declared.

**Breaking edge, deliberate.** `shortcut` and `bulkEnabled` were retired by
`@objectstack/spec` 17 as `retiredKey()` tombstones (`z.never()`), so authoring
either is already a hard parse rejection. Deriving their types rather than
hand-writing them turns that runtime rejection into a **compile error**: code
that assigned `shortcut: 'ctrl+k'` to an `ActionDef` compiled before and does
not now. Such metadata was already refused by the platform — this only moves the
failure to where it can be fixed. A host may still pass either explicitly via
`ActionEngine.registerAction(action, { shortcut, bulkEnabled })`; only authored
metadata stopped carrying them. `bulkEnabled`'s replacement is the list view's
`bulkActions` / `bulkActionDefs`; `shortcut` has none.

The index signature **stays** — removing it is step 3, and the inverted pin
asserting it is still present remains the issue's own completion check.
