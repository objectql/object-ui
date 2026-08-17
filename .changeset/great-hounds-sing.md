---
'@object-ui/fields': patch
---

A readonly group-labelled field is now DESCRIBED by its own help text, not just named by its label.

The seven `labelling: 'group'` widgets (`address`, `geolocation`, `checkboxes`, `radio`, `rating`, `file`, `multiselect`) render a `<FormDescription>` in their readonly and zero-option states, and the form renderer publishes its `id` — but nothing in the document referenced that id, so the visible help text had no programmatic association with the field it describes. Measured before the change, one field per row: `consumers=0` on every readonly surface of all seven, against `consumers=1` on the same widget's editable one.

`toHostGroupProps` now carries `aria-describedby` alongside the host `id` and `aria-labelledby`, onto the `role="group"` surface those states already render (a group is a description carrier under ARIA 1.2 — no focusable control required, which is why this became possible only once objectui#3990 gave those surfaces a role).

Control-channel state deliberately does NOT come along: `aria-invalid` and `aria-required` report what a user's editing may do wrong, and a readonly display cannot be edited. The boundary is pinned from both sides, including with a live failed validation on a readonly required field. Editable surfaces are unchanged — a composite's editable container still leaves the description on the sub-input the user focuses, so the help text is never announced twice.
