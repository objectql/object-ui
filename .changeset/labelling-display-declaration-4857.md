---
'@object-ui/core': minor
'@object-ui/components': minor
'@object-ui/fields': minor
---

`ComponentMeta.labelling` grows a third value: `'control' | 'group' | 'display'`
(objectui#4857, ruled jointly with objectui#4871 as the single repo-wide vocabulary for
"how does a host learn what a widget will render"). `'display'` declares a widget whose
whole surface is a pure display in EVERY state — no focusable control, nothing a
`<label for>` could ever reach.

The form renderer answers the declaration with the objectui#4788 host container (field
id + `aria-labelledby` + `aria-describedby` + `role="group"`) in the editable state too;
the `readonly === true` arm keeps its exact #4788 semantics for undeclared widgets. The
display-only four (`formula` / `summary` / `auto_number` / `vector`) declare `'display'`
— on the real object-form path they arrive `disabled`, never `readonly` (a deliberate
distinction this change does not touch), so their visible labels pointed `for` at an id
no element carried and their help text had zero consumers in every editable form.

`grid` was re-measured before being classified: its only bare-config focusable is the
auxiliary "Add line" button (routing `for` there would have label clicks insert rows),
and every realistic config is a table of per-cell inputs — a composite. It declares
`labelling: 'group'` and its root container now consumes the host id, name and
description, exactly like `address` / `checkboxes`.

Companion registry gate: `FIELD_WIDGET_LABELLING` (exported) is a `Record` keyed by the
field-widget map's own literal key union, so registering a widget without deciding its
labelling is a compile error rather than a silent fall-through to the dangling-`for`
path, and the declaration test asserts the registered meta agrees with it key by key.
