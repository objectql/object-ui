---
---

Test-only: `field-type-coverage.test.ts` now pins `'user'` in `FORM_WIDGET_TYPES`,
closing a one-way blindness in the field-type → renderer coverage guard —
`CELL_RENDERER_TYPES` already pinned `'user'`, but the form half did not, so
deleting the `user: 'field:user'` alias would have silently fallen back to
`field:text` on the form path while the guard stayed green. No published
behaviour changes.
