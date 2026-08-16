---
'@object-ui/plugin-form': patch
---

Fix: a `drawer` form with no `sections` now honours the object's field-level
conditional rules (`visibleWhen` / `readonlyWhen` / `requiredWhen`) and field
`group`.

`ModalForm` and `DrawerForm` each carried their own copy of the "object-schema
field to runtime FormField" loop for the no-sections case, and the drawer's
copy had fallen behind: it stopped at `multiple`, so the ADR-0036 predicates
never reached the runtime field and `resolveFieldRuleState` had nothing to
resolve. A hidden field rendered anyway, a frozen field stayed editable (with
the server then dropping the write), and a conditionally-required field never
blocked the submit.

Both containers now build that list through one shared `buildFlatFields`, which
resolves each field through the same `fromObjectSchema` the sectioned path uses
— so the next field-mapping fix lands once and reaches every container.
