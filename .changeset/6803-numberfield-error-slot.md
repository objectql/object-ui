---
'@object-ui/fields': patch
---

`NumberField` now reads the published `error` validation slot, so a number
field marked invalid is announced to assistive tech by the widget itself
(objectui#6803, closing an objectui#3222 gap).

The widget destructured `{ value, onChange, field, readonly, ...props }` with
no `error`, so the slot landed in the open tail and `toDomProps` — a whitelist
— dropped it. It wrote `aria-invalid` only while its own bad-input refusal was
active, which meant that on any host that does not hand a value down itself,
an invalid number field carried no `aria-invalid` at all.

`error` is now wired and the conditional spread becomes the ordinary
`aria-invalid={!!error || !!refusal}` the sibling number widgets already use.
Both halves ship together on purpose: reading `error` is what makes an
unconditional attribute safe to write, and leaving the attribute conditional
would have kept the wiring invisible. Un-conditionalising WITHOUT reading
`error` is the regression this pairing forbids — it would stamp `"false"` over
the correct value `FormControl`'s Radix Slot hands down.
