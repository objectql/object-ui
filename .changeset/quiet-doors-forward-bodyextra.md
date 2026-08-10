---
'@object-ui/components': patch
'@object-ui/core': patch
'@object-ui/types': patch
---

fix(actions): forward `bodyExtra` end-to-end through the action chain

An action's static request body (`bodyExtra`) was dropped one hop before the
`ActionRunner`: every action renderer forwards an explicit whitelist of keys, and
none of them listed `bodyExtra`. Since `@objectstack/spec` 17 made it the only way
a `type: 'api'` action can carry a payload (`params` keeps its single meaning as
the parameter definition array), and the ADR-0087
`inline-action-api-params-to-body-extra` conversion rewrites older object-form
`params` pages onto it at load, a previously-working published page validated,
published and then POSTed an empty body.

`element:button`, `action:button`, `action:group`, `action:icon` and `action:menu`
now forward the key; `ActionRunner.executeAPI` merges it into the request body
**last** (so a constant always overrides a same-named user param, matching the
console `apiHandler`); `ActionSchema` declares it; and a non-array `params` on a
`type: 'api'` action keeps working for one version window with a dev-mode
deprecation warning naming `bodyExtra`.
