---
'@object-ui/types': minor
'@object-ui/fields': minor
---

Publish `LocationValue` — the declared shape of a `location` field's value — and bind the
`LocationField` widget's produce and consume sites to `LocationValue | null`
(objectui#6154, maintainer ruling 2026-08-25).

The coordinates a location field carries are the field's **value**, not metadata:
`LocationFieldMetadata` correctly declares only `default_zoom` of its own. But no exported
type declared the value either, so a shape every consumer has to agree on was written down
nowhere a consumer could import, and the docs page had to describe it in prose while every
other page in the section annotates against an exported type.

`LocationValue` is `{ latitude: number; longitude: number }`, declared in `@object-ui/types`
beside `LocationFieldMetadata`. This is **additive**: no existing declaration is changed or
removed, and there is no behaviour change — the widget already produced exactly this shape.

Two things the declaration deliberately does NOT do, both ruled rather than overlooked.
It does not widen to the alias spellings the display path tolerates (`{ lat, lng }`,
`{ lat, lon }`, a `"lat,lng"` string, a `[lat, lng]` array): those are not contract, and
publishing them would fossilize a five-spelling dialect as protocol with nothing canonical
for an author or a code generator to aim at. And it does not narrow the runtime — the
display-side tolerance is untouched, so host data in an alias spelling keeps rendering
exactly as before. Retiring that tolerance is sequenced after this change, as objectui#6272.

The binding is `LocationValue | null` rather than `LocationValue`: clearing the input emits
`null`, which is measured widget output rather than defensive padding.
