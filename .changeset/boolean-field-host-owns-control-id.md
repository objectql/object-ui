---
'@object-ui/fields': patch
---

fix(fields): `BooleanField` uses the control id its host hands down, so a boolean field's visible label is really associated with the switch

A `boolean` / `checkbox` field inside a form emitted **two** labels with the same text, and the visible one pointed at nothing. `<FormControl>` (a Radix `Slot`) hands the control the id its `<FormLabel htmlFor>` already references, and the widget replaced it with the field name — so `label for="_r_3_-form-item"` had no target while the switch carried `id="notifications"`. Clicking the visible label, the normal affordance for a switch/checkbox row, toggled nothing on every generated form in every app; the accessible name survived only through the widget's own `sr-only` label.

The widget now honours the id it was handed (`id` is a declared key of the widget contract, forwarded by `toDomProps`) and stops emitting its own label when a host supplied one. Standalone rendering is unchanged: with no host id the id still falls back to the field name and then to `useId()`, and the `sr-only` label — the only accessible name the inline grid editor and the console's action-param dialog have — is still emitted.
