---
'@object-ui/components': minor
---

Form-field type resolution no longer falls back to `ui`-namespace SDUI node renderers.

A `FormSchema` field's `type` now resolves a `field:`-namespaced widget or takes
the builtin `default` input branch. It no longer falls back to
`ComponentRegistry.get(type)` — the bare name in whatever namespace happened to
hold it. (Maintainer ruling of 2026-08-19 on objectui#5254, option B.)

**This is a behaviour change, and it is the point of the change, not a side
effect.** A spelling that resolved yesterday stops resolving: a form field whose
`type` names a non-field component renders the default input instead of that
component. Measured on the built-in (no-`registerAllFields()`) path, the removed
fallback answered **126** bare names — `div`, `h1`, `card`, `button`, `form`,
`alert`, `badge`, the display `text` widget — and 116 of them with the fields
package registered as well. Marked `minor` for that reason. It is released as a
behaviour change rather than a fix because callers cannot tell from their own
metadata which of the two rules answered them; anyone who deliberately pointed a
form field at an SDUI component was relying on a rule no contract stated, and
that reliance now needs a `field:`-namespaced widget instead.

Nothing changes for the two paths that carry real traffic. With
`registerAllFields()` — the production configuration — every affected field type
already resolved its own `field:` widget (`email` to `field:email`, `password`
to `field:password`, `text` to `field:text`), and object-derived forms go
through `mapFieldTypeToFormType`, which has always emitted the `field:`-prefixed
id. Rendering one of these components as a top-level SDUI **node** is untouched:
this rule governs field resolution only.

What the fallback was producing on the built-in path, for
`{ name: 'contact', type: 'email', max_length: 50 }`:

```
attrs=["class","id","max_length","field","aria-describedby",
       "aria-invalid","type","value","name"]   maxlength=null
```

`email` and `password` are registered as `ui`-namespace node renderers for
top-level `{ type: 'email' }` nodes, so reached as a *field* they received the
field-widget prop bundle they do not implement and spread it onto the element:
the raw metadata object landed as `field="[object Object]"`, `max_length`
landed as an inert attribute with no cap in effect (`maxlength` null), and the
node renderer's own `<Label>` gave the control a second `<label>` on top of the
form's. All three are gone; the declared ceiling now actually caps
(`maxlength="50"`).

`email` and `password` keep rendering the native input they always rendered.
The default branch derives `<input type>` from those two declared field types
(`EmailFieldMetadata` / `PasswordFieldMetadata`), because `inputType` there is
whatever the author wrote and a plain `{ name, type: 'password' }` authors none
— without it that field would have rendered `type="text"` and shown a secret in
clear text. An explicitly authored `inputType` still wins. Other declared types
with a native HTML equivalent (`url`, `phone`, `number`, `color`, `date`)
already took this branch as `type="text"` and are unchanged.
