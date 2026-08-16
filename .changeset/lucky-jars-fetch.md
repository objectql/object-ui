---
'@object-ui/plugin-form': patch
---

`mobile.fullscreenLongText` now reaches fields the spec spells `richtext` (objectui#4831).

`ObjectForm` is the one and only producer of the `mobile_fullscreen` flag: when a form
sets `mobile: { fullscreenLongText: true }` it stamps that flag onto the metadata of
every long-text field, and the widget renders an expand affordance plus a full-height
editing dialog from it. The list of types it stamped was four hand-written literals —
`textarea`, `field:textarea`, `field:markdown`, `field:html` — and `field:richtext` was
not among them.

`richtext` is the name `@objectstack/spec`'s `FieldType` gives this type; `markdown` and
`html` are the other two, and all three are registry keys on ONE widget, `RichTextField`,
which has read the flag since objectui#3301. So the consumer side was complete and two of
the widget's three keys were stamped: a field authored exactly as the spec prescribes
(`type: richtext`) rendered the rich-text editor with no expand button, on a form whose
`mobile` documentation promises "textarea/rich-text get an expand button". `markdown` and
`html` beside it worked. This is the same hole objectui#4250 found in this package's
`WIDE_FIELD_TYPES`, which is why the twin set already lists `richtext` and this one did
not.

Adding the missing key is the whole change; no other type's behaviour moves, and a form
that has not opted in still stamps nothing.
