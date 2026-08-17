---
"@object-ui/components": patch
"@object-ui/fields": patch
---

fix(fields): deliver the host's a11y channels to `slider` and name `signature`

`SliderField` and `SignatureField` forwarded nothing a form host handed them —
neither spread `toDomProps(props)` at all — so `<FormControl>`'s whole payload
landed on nothing. Measured on a real form, one required field per row, freshly
failed validation:

```
slider     ariaInvalidTrue=[]  labelFor=…-form-item -> DANGLING  descConsumers=0  ids=[]
signature  ariaInvalidTrue=[]  labelFor=…-form-item -> DANGLING  descConsumers=0  ids=[]
text       ariaInvalidTrue=[input]  labelFor -> input            descConsumers=1
```

`ids=[]` is the tell: no element in either row carried an id at all, so the
visible label pointed `for` at nothing, the rendered help text had zero
consumers, and a failed slider announced no error state.

**`slider`** now delivers all three. Its focusable control is Radix's
`span[role="slider"]` thumb, which the synced `ui/slider.tsx` renders internally
and does not export, so the primitive grew a declared `thumbProps` — routed
through a new `lib/slider-thumb` and applied to the no-touch file as a declared
sync patch, so it survives regeneration. The split of which keys stay on Root
(`name`, `disabled`) is the one the `select` fix already settled.

**`signature`** gets the name and the description on a `role="group"` container.
Its control state deliberately does not follow: the drawing surface is a
`<canvas>` with no keyboard path, and its only other element is disabled while
the pad is empty, so there is no element a control state could be read from.

Both are now declared `labelling: 'group'` — a `<span>` and a `<canvas>` are not
labelable elements, so a host `for` could only dangle at them.
