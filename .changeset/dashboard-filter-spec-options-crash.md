---
"@object-ui/core": patch
"@object-ui/plugin-dashboard": patch
"@object-ui/types": patch
---

Fix: a dashboard filter declaring its static `options` in the
`@objectstack/spec` object form (`options: [{ value, label }]` — the shape
the spec validates and what framework-authored dashboards ship) crashed the
whole dashboard with "Objects are not valid as a React child". Caught driving
the showcase Revenue Pulse dashboard in a real browser.

`resolveDashboardFilterDefs` now normalizes both the spec object form and the
bare-string shorthand (`options: ['EMEA']`) to `{ value, label }` pairs —
`DashboardFilterDef.options` is typed accordingly — and the filter bar's
select renders labels (the trigger now shows the selected option's label, not
its raw value). `@object-ui/types` aligns the `GlobalFilterSchema.options`
shape with the spec union.
