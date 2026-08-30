---
'@object-ui/fields': patch
---

`CurrencyField` and `TagsField` now compose a host-supplied `onBlur` instead of
overriding it (objectui#6802).

`onBlur` is a DECLARED DOM pass-through key — named in `FieldWidgetDomProps`
and in `SDUI_DOM_PASS_THROUGH_KEYS`, and forwarded by `toDomProps` — but both
widgets wrote their own `onBlur={…}` AFTER the `{...toDomProps(props)}` spread,
so the host's handler was overwritten and never reached the control. Each now
resolves `toDomProps(props)` into `domProps` and calls `domProps.onBlur?.(e)`
at the end of its own handler, the idiom the other four widgets of this package
already use.

⚠️ This is a REAL behaviour change, not the no-op the finding was filed as. The
form renderer hosts every field through react-hook-form's `Controller` and
spreads the controller field — `{ name, value, onChange, onBlur, ref, disabled }`
— into the widget's props, so the overridden handler was the one that marks a
field touched and runs its validation. Concretely: on a form declaring
`validationMode: 'onBlur'` or `'onTouched'`, currency and tags fields were
silently opted out of blur-mode validation while every sibling field type kept
it. They now behave like the rest.

Currency keeps emitting its rounded value before handing the event on, so a
blur-mode validator reads the parsed amount rather than the raw text; tags
still commits the typed draft first, so the validator reads the committed list.
