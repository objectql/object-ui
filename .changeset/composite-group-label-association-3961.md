---
'@object-ui/core': minor
'@object-ui/components': patch
'@object-ui/fields': patch
---

Give composite and grouped field widgets a real accessible name: the form renderer now associates its label by IDREF for widgets that declare `labelling: 'group'`, instead of emitting a `<label for>` that nothing labelable answers (objectui#3961).

Six widgets rendered a visible group label that named **nothing** in the accessibility tree. Measured in a real form, one field per row, reading each label's `for` against the DOM:

```
address      for=…-form-item -> MISSING            byLabelText=0   role+name=0
geolocation  for=…-form-item -> MISSING            byLabelText=0   role+name=0
checkboxes   for=…-form-item -> div                byLabelText=0   role+name=0
radio        for=…-form-item -> div[radiogroup]    byLabelText=0   role+name=0
rating       for=…-form-item -> div                byLabelText=0   role+name=0
file         for=…-form-item -> div[role=button]   byLabelText=0   role+name=0
```

Two shapes, one outcome. `address` / `geolocation` spread the host's id onto their first sub-input and then replaced it with that input's own unique id (objectui#3343, correct in itself), so the `for` named an id no element carried — clicking "Shipping Address" did nothing and the group label was absent from the accessibility tree entirely. `checkboxes` / `radio` / `rating` / `file` kept the id, but on a `div`: a `<label for>` on a non-labelable element is inert HTML — `HTMLLabelElement.control` is `null`, so it activates nothing and contributes no name. A screen reader heard "Street Address", "City", "Alpha", "Beta" — never which group they belonged to.

The fix is the WAI-ARIA group pattern, driven by a DECLARATION rather than by the host guessing at widget DOM:

- `@object-ui/core` — `ComponentMeta` gains `labelling?: 'control' | 'group'`. Additive and optional; absent means `'control'`, which is every existing component's behaviour.
- `@object-ui/components` — the form renderer reads it. For a `'group'` field the `<FormLabel>` publishes an `id` and drops its `for`, and the widget receives `aria-labelledby`. The single-control path is unchanged down to the attribute: no id on the label, no `aria-labelledby` key on the widget, so no field acquires a second naming channel. `ui/form.tsx` is untouched (Shadcn no-touch) — both halves travel as ordinary props, since `<FormLabel>` spreads props after its own `htmlFor`.
- `@object-ui/fields` — the six audited widgets declare `labelling: 'group'`. `address` / `geolocation` move the host id (and only the id) from their first sub-input to the group container; `checkboxes` / `rating` answer a host-supplied `aria-labelledby` with `role="group"`; `radio` keeps Radix's more specific `radiogroup`; `file` takes the name on its dropzone with no invented group layer, because it has exactly one control that merely happens not to be labelable.

No new key in the widget props contract: `aria-*` is already declared on it and forwarded by `toDomProps`, the same channel `aria-required` (objectui#3290) travels.

Deliberately unchanged: sub-labels keep naming their own inputs (`aria-labelledby` overrides `<label for>`, so putting the group name on the first sub-input would have replaced "Street Address" with the field name — the concatenated-name outcome this issue rejected), `aria-describedby` stays on the first focusable sub-input where focus can reach it (objectui#3318), the sub-input ids of objectui#3343 do not move, and standalone rendering — the inline grid editor, a bare SDUI node, where nobody hands down an id and there is no host label to point at — emits no role and no IDREF at all.

A widget that does not declare itself keeps the old `for`, which the label-association tests report as an association resolving to a non-labelable element. Silence was the failure mode being fixed; the default path stays loud.
