---
"@object-ui/types": patch
"@object-ui/components": patch
"@object-ui/plugin-form": patch
---

fix(form): a split create/edit form no longer loses the panel you are not submitting from (#2153)

`SplitForm` rendered one `SchemaRenderer` — one react-hook-form instance and one
`<form>` element — **per section**, and its two groups of sections live in
separate resizable panels. So each panel owned isolated form state: submitting
from one panel's action bar sent only that section's fields and silently dropped
everything the user had typed on the other side of the divider. Filling both
panels and clicking Create persisted `{ subject }` alone.

The same isolation killed cross-panel field rules: a `visibleWhen` in the right
panel referencing a left-panel field never saw that field in its record, so the
predicate faulted and failed **open** — the field the author meant to hide was
always shown.

Both panels are now ONE form. The panel group became a layout the form renderer
owns, via a new `FormSchema.fieldPanes` (+ `fieldPanesOrientation`,
`fieldPanesResizable`) that mirrors `fieldTabs` (#2959): the `<form>` wraps the
whole `ResizablePanelGroup` and each pane holds only fields, which is what lets a
single react-hook-form instance span the divider. Sections inside a pane render
behind the inline `section-divider` header, each at its own declared column
density within the form's shared grid.

One more fix falls out of moving the panels into the renderer: `splitResizable:
false` now actually pins the divider. It previously only hid the grip — the
separator stayed draggable, because nothing passed the panel library's
`disabled`.

Each pane is its own `@container`, so a multi-column section collapses to fewer
columns as its panel is dragged narrower instead of overflowing.
