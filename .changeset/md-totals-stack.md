---
"@object-ui/plugin-form": minor
---

Master-detail form: live Subtotal / Tax / Total stack.

`MasterDetailForm` now renders a right-aligned document totals stack under the line items when the parent form has a tax-rate field (`taxRateField`, default `tax_rate`): **Subtotal** (Σ line amounts) → **Tax** (header rate %) → **Total**, recomputed live as lines and the rate change. The header rate is read via scoped event delegation on the form host (no coupling into `ObjectForm` internals). When the stack is shown, the per-grid footer total is subsumed.
