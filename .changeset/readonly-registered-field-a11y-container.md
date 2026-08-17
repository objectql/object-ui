---
'@object-ui/components': patch
---

A readonly field's replacement display is now named by the field's label and described by its help text.

A registered field widget's readonly branch renders a replacement display — a
`mailto:` anchor, a formatted span, a chip row, a preview table — and returns
before its DOM pass-through, so nothing the form renderer handed down reached an
element. Measured on a real form, one field per row, with `description` set: the
host control id (`…-form-item`) was on NO element in the document, so the visible
label's `for` pointed at nothing and the readonly surface had NO accessible name
at all, while the rendered help text had zero consumers. All 34 registered
non-group-labelled widget types read identically, including the four display-only
ones (`formula` / `summary` / `auto_number` / `vector`) whose whole widget is a
replacement display.

The form renderer now wraps a readonly registered field widget's output in a
container carrying the host id, `role="group"`, `aria-labelledby` and
`aria-describedby`, and the label publishes an `id` in place of its `for` — the
same WAI-ARIA group pattern objectui#3961 / #3990 / #4005 established for the
seven composite widgets, applied at the host instead of in each widget. Not one
widget file changed: the mechanism lands once, so the current widgets and any
future third-party one are correct by construction, with no "remember to spread
the host props" step left to miss.

The name is composite — the label's id AND the container's own — so the VALUE
stays in the accessible name (`Email user@example.com`, not just `Email`);
`group` is not a name-from-content role, and the value is usually the only thing
on screen. `aria-invalid` is deliberately dropped at this boundary: it is
control-channel state reporting what a user's own editing may do wrong, and a
readonly display cannot be edited (objectui#3291 / #3318 / #4005).

Two consequences worth stating. Readonly registered fields gain one DOM layer,
which end-to-end selectors written against the widget root as a direct child of
the form item will see; the layer carries `data-slot="readonly-field-group"` as a
stable locator. And because that layer is a block box where several readonly
faces were inline, those rows now take the form's standard label-to-value
spacing, matching the editable state. Builtin types (`input` / `textarea` /
`checkbox` / `switch` / `select`), editable fields, group-labelled widgets and
fields rendered without a label are untouched, byte for byte.
