---
'@object-ui/plugin-detail': patch
---

Inline-edit field enrichment passes `min`/`max`/`step` through to the numeric
editors (objectui#2572 live dogfood find). Both `DetailSection` and
`HeaderHighlight` copy an explicit whitelist of objectSchema keys into the
enriched field they hand `InlineFieldInput`; the numeric range/step
constraints were missing from that list, so a currency field declaring
`min: 0` rendered a number input with no range affordance. Adds a live e2e
spec (`e2e/live/inline-edit-polish-2572.spec.ts`) driving the whole #2572
polish set against the real showcase stack.
