---
"@object-ui/fields": patch
---

Group-labelled field widgets now consume the host label's IDREF in their readonly and zero-option states, so the visible label names something there too

A field declared `labelling: 'group'` (objectui#3961) is named by IDREF: the form
renderer publishes its `<FormLabel>`'s own `id`, drops the inert `for`, and hands
the widget `aria-labelledby` plus the host control `id`. All seven such widgets
consumed that pair on their editable surface only. A field-level
`readonly: true`, and an option list that resolved to zero offered options, take
early returns that render before the container doing the consuming — so the label
published an id that no element in the document referenced.

Measured on the previous `main`, one field per row in a real form, counting the
elements that reference the host label's published id:

```
                             consumers  byLabelText  named group
multiselect  readonly+value      0           0           0
multiselect  readonly+empty      0           0           0
multiselect  zeroOptions         0           0           0
multiselect  editable            1           1           1
```

All seven measured identically in every readonly state; each is 1 now. The
user-visible effect is the one objectui#3961 fixed for editable fields: the
visible label was the accessible name of NOTHING, so a readonly "Tags" or
"Shipping Address" was announced as loose text next to unattributed values. It is
not a regression of #3961 or objectui#3975 — before them these same states
emitted a `for` pointing at an id no element carried, which named nothing either.
The shape changed from a dangling `for` to an unconsumed IDREF; the defect did
not.

Each readonly surface now carries exactly two keys — the host `id` and
`aria-labelledby` — plus the `role="group"` that makes them meaningful, in one
shared spelling (`toHostGroupProps`). The narrow pair is deliberate: a readonly
display has no focusable control, so `aria-describedby` / `aria-required` /
`disabled` / the focus handlers have nothing to announce on, and `name` on a
`div` is exactly the DOM leak objectui#3291 sweeps for.

Two widgets answer with a different role than they do while editable, because
they render a different surface: `radio` (editable `radiogroup`) shows the chosen
option's label as text with no radios in it, and `file` (editable `button`, the
dropzone) shows file names with no dropzone. `role="group"` is also what the
shared "no options available" box now answers with for `checkboxes` / `radio` /
`multiselect`; the single `select` is not group-labelled, keeps its working
`for`, and that box emits nothing new for it.

Standalone rendering is untouched. The grid's inline cell editor and bare SDUI
nodes hand down neither key, so nothing is emitted and the markup stays
byte-identical — including the `EmptyValue` placeholder, which keeps its own
`aria-label` and gains no role. Hosted-and-empty, that placeholder is the whole
readonly surface, so it carries the group props: its `aria-label` ("No value") is
then outranked by `aria-labelledby` per accname, which is the intended outcome —
on the `generic` role that span carries, an author name is prohibited and was
never exposed, so the choice was between the field's name and no name.
