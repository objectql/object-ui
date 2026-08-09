---
"@object-ui/components": patch
---

Built-in `select` fields: the form's label, validation message and required state now reach the control

A hand-written form field `{ name: 'status', label: 'Status', type: 'select', options: [...] }`
rendered a visible "Status" label that pointed at nothing. Measured before the fix:
`<label for="…-form-item">` resolved to no element at all, `getByLabelText(/status/i)`
found zero matches, and the trigger button carried no `id`, no `aria-describedby`, no
`aria-invalid` and no `aria-required`. Clicking the label did nothing and a screen reader
announced an anonymous combobox with no field name, no error link and no required state.

Cause: the built-in `select` branch spread its whole DOM pass-through onto Radix's
`Select.Root`. Root renders no DOM element of its own, so everything it does not
recognise is silently dropped — and that is exactly where `<FormControl>`'s Slot puts the
field's `id` / `aria-describedby` / `aria-invalid` and the renderer puts `aria-required`.
The pass-through now lands on `SelectTrigger`, the focusable `button[role=combobox]` the
user and their assistive tech actually operate, with the same two keys deliberately kept
on Root as in the widget-side fix: `name` (the one key Root consumes — it forwards it to
the hidden native `select` that takes part in form submission) and `disabled` (Root
disables trigger, items and hidden select together, so the raw prop must not gain a second
author). `ref` rides the pass-through too, so react-hook-form can finally focus a built-in
select.

This is the built-in half of the same mechanism objectui#3306 fixed on the widget side.
The two halves diverged because `'select'` is a `BUILTIN_FIELD_TYPES` member: an
object-driven `field:select` resolves to the registered `SelectField` (fixed since #3306),
while a hand-written bare `type: 'select'` never consults the registry and kept the
defect. Both paths are now pinned side by side — the registered path as a positive control
— so they cannot drift apart again. Which component renders a bare `select` is unchanged;
only where its host props land.

Authored `className` on a built-in `select` now reaches the trigger (it previously reached
no element), composed with the branch's touch-target height rather than replacing it.
