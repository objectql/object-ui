---
'@object-ui/app-shell': patch
---

Flow Screen preview: gate fields by `visibleWhen` (follow-up to #1944)

The Screen-node preview now evaluates each input field's `visibleWhen` against
the active variables — reusing the simulator's own condition evaluator
(`evalCondition`), normalising `{var}` placeholders to bare identifiers — so it
hides/shows conditional fields exactly as the runtime `screen` executor does
(which filters server-side before emitting the `ScreenSpec`).

- Debug simulator (live run state): gates faithfully, e.g. a screen whose
  `opportunityName`/`opportunityAmount` are `visibleWhen: "{createOpportunity} == true"`
  hides them while `createOpportunity` is false.
- Inspector (no run state): fails open — an unparseable or not-yet-decidable
  condition keeps the field visible, so configured fields are never hidden on
  missing data — and a footnote reports how many fields are gated out.
