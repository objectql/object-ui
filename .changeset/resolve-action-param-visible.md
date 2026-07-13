---
"@object-ui/app-shell": patch
---

fix(app-shell): propagate action-param `visible` predicate through resolveActionParams

The create-user phone fix (#2406) gated the `phoneNumber` param with
`visible: 'features.phoneNumber == true'`, but `resolveActionParam` dropped
`visible` when flattening raw spec params into `ActionParamDef` — so
`ActionParamDialog`'s `filterVisibleParams` never saw the predicate and the
phone field kept rendering even with the phoneNumber auth plugin off.

Propagate `visible` in all three resolve branches (inline / field-backed /
missing-field), unwrapping the spec's `{ dialect, source }` ExpressionInput
envelope to a plain CEL string. Completes the create-user phone fix end to end.
