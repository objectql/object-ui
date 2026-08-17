---
'@object-ui/app-shell': patch
---

metadata-admin: SchemaForm emits the naming channel each widget DECLARES, and the colour widget splits into two registrations

`MetadataField` wrote `<Label htmlFor={id}>` for every field and handed the same
`id` down on the convention "the wrapped control carries it". Probed across the
whole `WIDGETS` registry, both the editable and the read-only state: eight keys
pointed that `for` at an id **no element in the document carried** — a dangling
IDREF, which reads as a closed association to tooling and to assistive tech
while naming nothing. Two more (`field-multi`, `action-multi`) resolved in the
editable state and dangled in the read-only one, because the element that
carried the id was an auxiliary "add" picker gated behind `!readOnly`.

The registry now carries `WIDGET_LABELLING`, a table keyed by the widget map's
own literal key union — registering a widget without deciding how the host's
label reaches it is a compile error, not a silent fall-through to the dangling
path. Its vocabulary is derived from `ComponentMeta['labelling']` in
`@object-ui/core` rather than restated locally (the 2026-08-17 ruling on
objectui#4857 + objectui#4871). `'control'` keeps the plain `<label for>`;
`'group'` publishes the label's own `id`, hands it down as `aria-labelledby`,
and **drops** the `for`.

`color-picker` was one entry that chose between a swatch `radiogroup` and a
labelable `input[type="color"]` at runtime — after the host had already written
the label, which is why the host could not know which channel to emit. It is two
registrations now (`color-picker` / `color-input`) and the **host** picks between
them from the schema, before the label. Both read the palette through one shared
function, so host and widget cannot disagree about which surface renders.

Also fixed on the way, both measured by the same probe: `secret` and the free
colour picker carried self-owned `aria-label` constants that **won** the
accessible-name computation, so fields labelled "API Key" or "Brand Color"
announced as "Secret value" and "Color"; those now defer to the host label and
keep the constant only for a caller that renders them with no label at all. The
hex box beside the colour picker, and the boolean switches inside
`dynamic-config`, had no accessible name at all.
